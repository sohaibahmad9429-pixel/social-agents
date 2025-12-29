"""
Meta Credentials Service
Production-ready credential management for Meta Ads API

Handles:
- Credential retrieval from social_accounts (priority: meta_ads > facebook > instagram)
- Credential encryption/decryption
- Token expiration checking
- Ad account capability verification
- Business portfolio fetching
"""
import logging
import json
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta

from ..services.supabase_service import get_supabase_admin_client
from ..services.meta_ads_service import get_meta_ads_service
from ..config import settings

logger = logging.getLogger(__name__)

# Token is considered expiring soon if less than 7 days remain
TOKEN_EXPIRY_WARNING_DAYS = 7


class MetaCredentialsService:
    """
    Unified credential management for Facebook, Instagram, and Meta Ads
    
    Uses existing Facebook/Instagram OAuth credentials for Ads.
    Priority: meta_ads > facebook > instagram
    """
    
    @staticmethod
    async def get_meta_credentials(
        workspace_id: str,
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get Meta credentials from any connected Meta platform
        Priority: meta_ads > facebook > instagram
        
        Returns credentials dict with:
        - access_token: OAuth access token
        - user_access_token: User token for ads API (if available)
        - page_id, page_name: Facebook page info
        - account_id, account_name: Ad account info
        - expires_at: Token expiration
        - is_expired, expires_soon: Token status flags
        """
        try:
            client = get_supabase_admin_client()
            platforms = ["meta_ads", "facebook", "instagram"]
            
            for platform in platforms:
                result = client.table("social_accounts").select(
                    "id, platform, credentials_encrypted, page_id, page_name, "
                    "account_id, account_name, username, expires_at, access_token_expires_at"
                ).eq("workspace_id", workspace_id).eq("platform", platform).maybe_single().execute()
                
                if not result.data or not result.data.get("credentials_encrypted"):
                    continue
                
                # Decrypt credentials
                try:
                    credentials = MetaCredentialsService._decrypt_credentials(
                        result.data["credentials_encrypted"]
                    )
                    
                    if not credentials or not credentials.get("accessToken"):
                        continue
                    
                    # Check token expiration
                    expires_at = result.data.get("expires_at") or result.data.get("access_token_expires_at")
                    is_expired, expires_soon = MetaCredentialsService._check_token_expiration(expires_at)
                    
                    if is_expired:
                        logger.warning(f"Token expired for platform {platform}, trying next")
                        continue
                    
                    return {
                        "access_token": credentials.get("accessToken"),
                        "user_access_token": credentials.get("userAccessToken"),
                        "page_id": result.data.get("page_id") or credentials.get("pageId"),
                        "page_name": result.data.get("page_name") or credentials.get("pageName"),
                        "account_id": result.data.get("account_id") or credentials.get("adAccountId"),
                        "account_name": result.data.get("account_name") or credentials.get("adAccountName"),
                        "username": result.data.get("username") or credentials.get("username"),
                        "expires_at": str(expires_at) if expires_at else None,
                        "is_expired": is_expired,
                        "expires_soon": expires_soon,
                        "currency": credentials.get("currency"),
                        "timezone": credentials.get("timezone"),
                        "business_id": credentials.get("businessId"),
                        "business_name": credentials.get("businessName"),
                    }
                except Exception as decrypt_error:
                    logger.error(f"Failed to decrypt credentials for {platform}: {decrypt_error}")
                    continue
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting Meta credentials: {e}")
            return None
    
    @staticmethod
    def _decrypt_credentials(encrypted: str) -> Optional[Dict[str, Any]]:
        """
        Decrypt credentials
        
        Note: In production, this should use proper encryption key from workspace.
        For now, we assume credentials are stored as JSON (matching existing pattern).
        """
        try:
            # Try parsing as JSON first (for development/simple case)
            if encrypted.startswith("{"):
                return json.loads(encrypted)
            
            # In production with actual encryption, implement decryption here
            # This would use the workspace encryption key
            # For now, return None if not parseable
            logger.warning("Credentials appear to be encrypted but decryption not implemented")
            return None
            
        except json.JSONDecodeError:
            logger.error("Failed to parse credentials as JSON")
            return None
    
    @staticmethod
    def _check_token_expiration(expires_at: Any) -> tuple[bool, bool]:
        """Check if token is expired or expiring soon"""
        if not expires_at:
            return False, False
        
        try:
            if isinstance(expires_at, str):
                expiry_date = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
            else:
                expiry_date = expires_at
            
            now = datetime.now(timezone.utc)
            days_remaining = (expiry_date - now).days
            
            is_expired = days_remaining <= 0
            expires_soon = 0 < days_remaining <= TOKEN_EXPIRY_WARNING_DAYS
            
            return is_expired, expires_soon
            
        except Exception as e:
            logger.error(f"Error checking token expiration: {e}")
            return False, False
    
    @staticmethod
    async def get_ads_credentials(
        workspace_id: str,
        user_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Get credentials specifically for Meta Ads operations
        Uses userAccessToken for ads API calls (not Page token)
        
        Returns format compatible with Meta Ads API:
        - access_token
        - account_id
        - account_name
        - page_id
        - page_name
        - expires_at
        - is_expired
        - expires_soon
        """
        credentials = await MetaCredentialsService.get_meta_credentials(workspace_id, user_id)
        
        if not credentials:
            return None
        
        # Use userAccessToken for ads API calls if available
        ads_token = credentials.get("user_access_token") or credentials.get("access_token")
        
        # If no ad account ID, try to fetch it
        account_id = credentials.get("account_id")
        account_name = credentials.get("account_name")
        
        if not account_id and ads_token:
            try:
                service = get_meta_ads_service()
                ad_account_info = await MetaCredentialsService._fetch_ad_account_from_api(ads_token)
                
                if ad_account_info:
                    account_id = ad_account_info.get("account_id")
                    account_name = ad_account_info.get("account_name")
                    
                    # Update stored credentials
                    await MetaCredentialsService.update_ad_account_info(
                        workspace_id, account_id, account_name
                    )
            except Exception as e:
                logger.error(f"Error fetching ad account: {e}")
        
        return {
            "access_token": ads_token,
            "account_id": account_id,
            "account_name": account_name,
            "page_id": credentials.get("page_id"),
            "page_name": credentials.get("page_name"),
            "expires_at": credentials.get("expires_at"),
            "is_expired": credentials.get("is_expired", False),
            "expires_soon": credentials.get("expires_soon", False),
        }
    
    @staticmethod
    async def _fetch_ad_account_from_api(access_token: str) -> Optional[Dict[str, Any]]:
        """
        Fetch ad account from Meta API using business portfolios
        Only uses Business Portfolio owned ad accounts
        """
        try:
            service = get_meta_ads_service()
            
            # Get user's businesses
            businesses_result = await service.fetch_user_businesses(access_token)
            businesses = businesses_result.get("businesses", [])
            
            if not businesses:
                return None
            
            # Try to find ad account from first business with ad accounts
            for business in businesses:
                accounts_result = await service.fetch_business_ad_accounts(
                    business["id"], access_token
                )
                ad_accounts = accounts_result.get("adAccounts", [])
                
                if ad_accounts:
                    first_account = ad_accounts[0]
                    return {
                        "account_id": first_account.get("account_id"),
                        "account_name": first_account.get("name"),
                        "currency": first_account.get("currency"),
                        "timezone": first_account.get("timezone"),
                        "business_id": business["id"],
                        "business_name": business.get("name"),
                    }
            
            return None
            
        except Exception as e:
            logger.error(f"Error fetching ad account from API: {e}")
            return None
    
    @staticmethod
    async def update_ad_account_info(
        workspace_id: str,
        account_id: str,
        account_name: Optional[str] = None
    ) -> bool:
        """Update stored credentials with ad account info"""
        try:
            client = get_supabase_admin_client()
            
            # Find existing Meta platform credentials
            result = client.table("social_accounts").select("id").eq(
                "workspace_id", workspace_id
            ).in_("platform", ["facebook", "instagram", "meta_ads"]).limit(1).execute()
            
            if not result.data:
                return False
            
            # Update account info
            client.table("social_accounts").update({
                "account_id": account_id,
                "account_name": account_name,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", result.data[0]["id"]).execute()
            
            logger.info(f"Updated ad account info for workspace {workspace_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error updating ad account info: {e}")
            return False
    
    @staticmethod
    async def check_ads_capability(
        workspace_id: str,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Check if workspace can run Meta Ads
        
        Returns:
        - has_ads_access: Whether workspace can run ads
        - ad_account_id, ad_account_name: Ad account info (if available)
        - page_id, page_name: Facebook page info
        - missing_permissions: List of what's missing
        """
        credentials = await MetaCredentialsService.get_ads_credentials(workspace_id, user_id)
        
        if not credentials:
            return {
                "has_ads_access": False,
                "missing_permissions": ["No Meta platform connected"]
            }
        
        if credentials.get("account_id"):
            return {
                "has_ads_access": True,
                "ad_account_id": credentials["account_id"],
                "ad_account_name": credentials.get("account_name"),
                "page_id": credentials.get("page_id"),
                "page_name": credentials.get("page_name"),
            }
        
        # Have credentials but no ad account
        if credentials.get("page_id"):
            return {
                "has_ads_access": False,
                "page_id": credentials["page_id"],
                "page_name": credentials.get("page_name"),
                "missing_permissions": ["No Ad Account found. Please ensure your Facebook account has access to an Ad Account."]
            }
        
        return {
            "has_ads_access": False,
            "missing_permissions": ["No Facebook Page or Ad Account connected"]
        }
    
    @staticmethod
    async def get_connection_status(workspace_id: str) -> Dict[str, Any]:
        """
        Get detailed connection status for all Meta platforms
        """
        try:
            client = get_supabase_admin_client()
            
            result = client.table("social_accounts").select(
                "platform, is_connected, username, page_id, page_name, "
                "account_id, account_name, credentials_encrypted"
            ).eq("workspace_id", workspace_id).in_(
                "platform", ["facebook", "instagram", "meta_ads"]
            ).execute()
            
            status = {
                "facebook": {"isConnected": False},
                "instagram": {"isConnected": False},
                "metaAds": {"isConnected": False},
                "canRunAds": False,
                "missingForAds": []
            }
            
            for account in result.data or []:
                has_credentials = bool(account.get("credentials_encrypted"))
                
                if account["platform"] == "facebook":
                    status["facebook"] = {
                        "isConnected": has_credentials,
                        "username": account.get("username"),
                        "pageId": account.get("page_id"),
                        "pageName": account.get("page_name"),
                    }
                elif account["platform"] == "instagram":
                    status["instagram"] = {
                        "isConnected": has_credentials,
                        "username": account.get("username"),
                    }
                elif account["platform"] == "meta_ads":
                    status["metaAds"] = {
                        "isConnected": has_credentials,
                        "adAccountId": account.get("account_id"),
                        "adAccountName": account.get("account_name"),
                    }
            
            # Check ads capability
            if status["facebook"]["isConnected"] or status["metaAds"]["isConnected"]:
                capability = await MetaCredentialsService.check_ads_capability(workspace_id)
                status["canRunAds"] = capability.get("has_ads_access", False)
                
                if not status["canRunAds"]:
                    status["missingForAds"] = capability.get("missing_permissions", [])
                else:
                    status["metaAds"]["adAccountId"] = capability.get("ad_account_id")
                    status["metaAds"]["adAccountName"] = capability.get("ad_account_name")
            else:
                status["missingForAds"] = ["Connect Facebook to run ads"]
            
            return status
            
        except Exception as e:
            logger.error(f"Error getting connection status: {e}")
            return {
                "facebook": {"isConnected": False},
                "instagram": {"isConnected": False},
                "metaAds": {"isConnected": False},
                "canRunAds": False,
                "missingForAds": ["Error checking connection status"]
            }
    
    @staticmethod
    async def get_available_businesses(
        workspace_id: str,
        user_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Get all available business portfolios with their ad accounts
        """
        credentials = await MetaCredentialsService.get_meta_credentials(workspace_id, user_id)
        
        if not credentials:
            return []
        
        access_token = credentials.get("user_access_token") or credentials.get("access_token")
        if not access_token:
            return []
        
        try:
            service = get_meta_ads_service()
            
            businesses_result = await service.fetch_user_businesses(access_token)
            businesses = businesses_result.get("businesses", [])
            
            result = []
            for business in businesses:
                accounts_result = await service.fetch_business_ad_accounts(
                    business["id"], access_token
                )
                
                result.append({
                    "id": business["id"],
                    "name": business.get("name"),
                    "adAccounts": accounts_result.get("adAccounts", [])
                })
            
            return result
            
        except Exception as e:
            logger.error(f"Error fetching businesses: {e}")
            return []
    
    @staticmethod
    async def switch_business(
        workspace_id: str,
        business_id: str,
        ad_account_id: Optional[str] = None,
        user_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Switch to a different business portfolio and ad account
        """
        try:
            credentials = await MetaCredentialsService.get_meta_credentials(workspace_id, user_id)
            
            if not credentials:
                return {"success": False, "error": "No Meta credentials found"}
            
            access_token = credentials.get("user_access_token") or credentials.get("access_token")
            service = get_meta_ads_service()
            
            # Get ad accounts for the business
            accounts_result = await service.fetch_business_ad_accounts(business_id, access_token)
            ad_accounts = accounts_result.get("adAccounts", [])
            
            if not ad_accounts:
                return {"success": False, "error": "No ad accounts found for this business"}
            
            # Use specified ad account or first available
            selected_account = None
            if ad_account_id:
                selected_account = next(
                    (acc for acc in ad_accounts if acc.get("account_id") == ad_account_id),
                    None
                )
            
            if not selected_account:
                selected_account = ad_accounts[0]
            
            # Update credentials in database
            client = get_supabase_admin_client()
            
            # Find the social account record
            result = client.table("social_accounts").select("id").eq(
                "workspace_id", workspace_id
            ).in_("platform", ["facebook", "instagram", "meta_ads"]).limit(1).execute()
            
            if result.data:
                client.table("social_accounts").update({
                    "account_id": selected_account.get("account_id"),
                    "account_name": selected_account.get("name"),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", result.data[0]["id"]).execute()
            
            return {
                "success": True,
                "businessId": business_id,
                "adAccount": selected_account
            }
            
        except Exception as e:
            logger.error(f"Error switching business: {e}")
            return {"success": False, "error": str(e)}


# Singleton instance
_credentials_service: Optional[MetaCredentialsService] = None


def get_meta_credentials_service() -> MetaCredentialsService:
    """Get MetaCredentialsService (stateless, just for organization)"""
    global _credentials_service
    if _credentials_service is None:
        _credentials_service = MetaCredentialsService()
    return _credentials_service

"""
SDK Settings Service
Meta Business SDK - Account/Business Settings

Uses:
- Meta Marketing API v24.0
- Business, Account, Pixel, and Activity management
"""
import asyncio
import logging
from typing import Optional, Dict, Any

import httpx

from ...config import settings

logger = logging.getLogger(__name__)

# API Version
META_API_VERSION = "v24.0"


class SettingsService:
    """Service for Meta account and business settings."""
    
    def __init__(self, access_token: str):
        """
        Initialize Settings Service.
        
        Args:
            access_token: User access token with business_management permission
        """
        self.access_token = access_token
    
    def _get_business_settings_sync(self, business_id: str) -> Dict[str, Any]:
        """
        Get business settings for a Business Manager.
        
        Per Meta Marketing API v24.0 - Business object.
        """
        try:
            url = f"https://graph.facebook.com/{META_API_VERSION}/{business_id}"
            params = {
                "access_token": self.access_token,
                "fields": "id,name,created_time,timezone,primary_page,profile_picture_uri,verification_status,vertical"
            }
            
            response = httpx.get(url, params=params, timeout=30.0)
            
            if response.is_success:
                return {"success": True, "business": response.json()}
            else:
                error_data = response.json()
                return {
                    "success": False,
                    "error": error_data.get("error", {}).get("message", "Failed to get business settings")
                }
                
        except Exception as e:
            logger.error(f"Get business settings error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_business_settings(self, business_id: str) -> Dict[str, Any]:
        """
        Get business settings.
        
        Args:
            business_id: Business ID
            
        Returns:
            Dict with business settings
        """
        return await asyncio.to_thread(self._get_business_settings_sync, business_id)
    
    def _get_ad_account_users_sync(self, account_id: str) -> Dict[str, Any]:
        """
        Get users with access to an ad account (Team Access).
        
        Per Meta Marketing API v24.0 - AdAccount users edge.
        """
        try:
            if not account_id.startswith('act_'):
                account_id = f'act_{account_id}'
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{account_id}/users"
            params = {
                "access_token": self.access_token,
                "fields": "id,name,role,permissions"
            }
            
            response = httpx.get(url, params=params, timeout=30.0)
            
            if response.is_success:
                data = response.json()
                return {"success": True, "users": data.get("data", [])}
            else:
                error_data = response.json()
                return {
                    "success": False,
                    "error": error_data.get("error", {}).get("message", "Failed to get users")
                }
                
        except Exception as e:
            logger.error(f"Get ad account users error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_ad_account_users(self, account_id: str) -> Dict[str, Any]:
        """
        Get team access users for an ad account.
        
        Args:
            account_id: Ad Account ID
            
        Returns:
            Dict with list of users
        """
        return await asyncio.to_thread(self._get_ad_account_users_sync, account_id)
    
    def _get_notification_settings_sync(self, account_id: str) -> Dict[str, Any]:
        """
        Get notification settings for an ad account.
        
        Note: Meta API doesn't have a direct notification settings endpoint.
        This returns the ad rules configured for notifications.
        """
        try:
            if not account_id.startswith('act_'):
                account_id = f'act_{account_id}'
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{account_id}/adrules_library"
            params = {
                "access_token": self.access_token,
                "fields": "id,name,status,execution_spec",
                "filtering": '[{"field":"execution_spec","operator":"CONTAIN","value":"notification"}]'
            }
            
            response = httpx.get(url, params=params, timeout=30.0)
            
            if response.is_success:
                data = response.json()
                # Extract notification rules
                notification_rules = []
                for rule in data.get("data", []):
                    exec_spec = rule.get("execution_spec", {})
                    if exec_spec.get("execution_type") == "NOTIFICATION":
                        notification_rules.append(rule)
                
                return {
                    "success": True,
                    "notification_rules": notification_rules,
                    "total_count": len(notification_rules)
                }
            else:
                error_data = response.json()
                return {
                    "success": False,
                    "error": error_data.get("error", {}).get("message", "Failed to get notification settings")
                }
                
        except Exception as e:
            logger.error(f"Get notification settings error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_notification_settings(self, account_id: str) -> Dict[str, Any]:
        """
        Get notification settings for an ad account.
        
        Args:
            account_id: Ad Account ID
            
        Returns:
            Dict with notification rules
        """
        return await asyncio.to_thread(self._get_notification_settings_sync, account_id)
    
    def _get_funding_source_sync(self, account_id: str) -> Dict[str, Any]:
        """
        Get funding source (payment methods) for an ad account.
        
        Per Meta Marketing API v24.0.
        """
        try:
            if not account_id.startswith('act_'):
                account_id = f'act_{account_id}'
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{account_id}"
            params = {
                "access_token": self.access_token,
                "fields": "funding_source,funding_source_details"
            }
            
            response = httpx.get(url, params=params, timeout=30.0)
            
            if response.is_success:
                return {"success": True, "funding": response.json()}
            else:
                error_data = response.json()
                return {
                    "success": False,
                    "error": error_data.get("error", {}).get("message", "Failed to get funding source")
                }
                
        except Exception as e:
            logger.error(f"Get funding source error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_funding_source(self, account_id: str) -> Dict[str, Any]:
        """
        Get funding source for an ad account.
        
        Args:
            account_id: Ad Account ID
            
        Returns:
            Dict with funding source details
        """
        return await asyncio.to_thread(self._get_funding_source_sync, account_id)
    
    def _get_ad_account_pixels_sync(self, account_id: str) -> Dict[str, Any]:
        """
        Get all pixels for an ad account.
        
        Per Meta Marketing API v24.0 - AdsPixels edge.
        """
        try:
            if not account_id.startswith('act_'):
                account_id = f'act_{account_id}'
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{account_id}/adspixels"
            params = {
                "access_token": self.access_token,
                "fields": "id,name,code,creation_time,creator,is_created_by_business,owner_ad_account,owner_business,last_fired_time,data_use_setting,enable_automatic_matching,first_party_cookie_status"
            }
            
            response = httpx.get(url, params=params, timeout=30.0)
            
            if response.is_success:
                data = response.json()
                return {"success": True, "pixels": data.get("data", [])}
            else:
                error_data = response.json()
                return {
                    "success": False,
                    "error": error_data.get("error", {}).get("message", "Failed to get pixels")
                }
                
        except Exception as e:
            logger.error(f"Get ad account pixels error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_ad_account_pixels(self, account_id: str) -> Dict[str, Any]:
        """
        Get all pixels for an ad account.
        
        Args:
            account_id: Ad Account ID
            
        Returns:
            Dict with list of pixels
        """
        return await asyncio.to_thread(self._get_ad_account_pixels_sync, account_id)
    
    def _get_pixel_details_sync(self, pixel_id: str) -> Dict[str, Any]:
        """
        Get details for a single pixel.
        
        Per Meta Marketing API v24.0.
        """
        try:
            url = f"https://graph.facebook.com/{META_API_VERSION}/{pixel_id}"
            params = {
                "access_token": self.access_token,
                "fields": "id,name,code,creation_time,creator,is_created_by_business,owner_ad_account,owner_business,last_fired_time,data_use_setting,enable_automatic_matching,first_party_cookie_status"
            }
            
            response = httpx.get(url, params=params, timeout=30.0)
            
            if response.is_success:
                return {"success": True, "pixel": response.json()}
            else:
                error_data = response.json()
                return {
                    "success": False,
                    "error": error_data.get("error", {}).get("message", "Failed to get pixel details")
                }
                
        except Exception as e:
            logger.error(f"Get pixel details error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_pixel_details(self, pixel_id: str) -> Dict[str, Any]:
        """
        Get details for a single pixel.
        
        Args:
            pixel_id: Pixel ID
            
        Returns:
            Dict with pixel details
        """
        return await asyncio.to_thread(self._get_pixel_details_sync, pixel_id)
    
    def _get_pixel_assigned_users_sync(self, pixel_id: str) -> Dict[str, Any]:
        """
        Get users assigned to a pixel.
        
        Per Meta Marketing API v24.0 - assigned_users edge.
        """
        try:
            url = f"https://graph.facebook.com/{META_API_VERSION}/{pixel_id}/assigned_users"
            params = {
                "access_token": self.access_token,
                "fields": "id,name,tasks"
            }
            
            response = httpx.get(url, params=params, timeout=30.0)
            
            if response.is_success:
                data = response.json()
                return {"success": True, "users": data.get("data", [])}
            else:
                error_data = response.json()
                return {
                    "success": False,
                    "error": error_data.get("error", {}).get("message", "Failed to get pixel users")
                }
                
        except Exception as e:
            logger.error(f"Get pixel assigned users error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_pixel_assigned_users(self, pixel_id: str) -> Dict[str, Any]:
        """
        Get users assigned to a pixel.
        
        Args:
            pixel_id: Pixel ID
            
        Returns:
            Dict with list of users
        """
        return await asyncio.to_thread(self._get_pixel_assigned_users_sync, pixel_id)
    
    def _update_pixel_settings_sync(
        self, 
        pixel_id: str, 
        name: Optional[str] = None,
        enable_automatic_matching: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """
        Update pixel settings.
        
        Per Meta Marketing API v24.0.
        """
        try:
            params = {}
            if name is not None:
                params["name"] = name
            if enable_automatic_matching is not None:
                params["enable_automatic_matching"] = enable_automatic_matching
            
            if not params:
                return {"success": False, "error": "No updates provided"}
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{pixel_id}"
            params["access_token"] = self.access_token
            
            response = httpx.post(url, params=params, timeout=30.0)
            
            if response.is_success:
                return {"success": True, "pixel_id": pixel_id}
            else:
                error_data = response.json()
                return {
                    "success": False,
                    "error": error_data.get("error", {}).get("message", "Failed to update pixel")
                }
                
        except Exception as e:
            logger.error(f"Update pixel settings error: {e}")
            return {"success": False, "error": str(e)}
    
    async def update_pixel_settings(
        self, 
        pixel_id: str, 
        name: Optional[str] = None,
        enable_automatic_matching: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """
        Update pixel settings.
        
        Args:
            pixel_id: Pixel ID
            name: New pixel name
            enable_automatic_matching: Enable automatic matching
            
        Returns:
            Dict with success status
        """
        return await asyncio.to_thread(
            self._update_pixel_settings_sync,
            pixel_id,
            name,
            enable_automatic_matching
        )
    
    def _get_ad_account_activities_sync(
        self, 
        account_id: str,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """
        Get activity log for an ad account.
        
        Per Meta Marketing API v24.0 - activities edge.
        """
        try:
            if not account_id.startswith('act_'):
                account_id = f'act_{account_id}'
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{account_id}/activities"
            params = {
                "access_token": self.access_token,
                "fields": "actor_id,actor_name,application_name,date_time_in_timezone,event_time,event_type,object_id,object_name,translated_event_type,extra_data",
                "limit": limit
            }
            
            response = httpx.get(url, params=params, timeout=30.0)
            
            if response.is_success:
                data = response.json()
                return {"success": True, "activities": data.get("data", [])}
            else:
                error_data = response.json()
                return {
                    "success": False,
                    "error": error_data.get("error", {}).get("message", "Failed to get activities")
                }
                
        except Exception as e:
            logger.error(f"Get ad account activities error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_ad_account_activities(
        self, 
        account_id: str,
        limit: int = 50,
    ) -> Dict[str, Any]:
        """
        Get activity log for an ad account.
        
        Args:
            account_id: Ad Account ID
            limit: Max activities to return
            
        Returns:
            Dict with list of activities
        """
        return await asyncio.to_thread(
            self._get_ad_account_activities_sync,
            account_id,
            limit
        )
    
    def _get_business_invoices_sync(self, business_id: str) -> Dict[str, Any]:
        """
        Get invoices for a business.
        
        Per Meta Marketing API v24.0 - business_invoices edge.
        """
        try:
            url = f"https://graph.facebook.com/{META_API_VERSION}/{business_id}/business_invoices"
            params = {
                "access_token": self.access_token,
                "fields": "id,billing_period,entity,amount,status"
            }
            
            response = httpx.get(url, params=params, timeout=30.0)
            
            if response.is_success:
                data = response.json()
                return {"success": True, "invoices": data.get("data", [])}
            else:
                error_data = response.json()
                return {
                    "success": False,
                    "error": error_data.get("error", {}).get("message", "Failed to get invoices")
                }
                
        except Exception as e:
            logger.error(f"Get business invoices error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_business_invoices(self, business_id: str) -> Dict[str, Any]:
        """
        Get invoices for a business.
        
        Args:
            business_id: Business ID
            
        Returns:
            Dict with list of invoices
        """
        return await asyncio.to_thread(self._get_business_invoices_sync, business_id)
    
    def _get_spend_cap_history_sync(self, account_id: str) -> Dict[str, Any]:
        """
        Get spend cap history for an ad account.
        
        Per Meta Marketing API v24.0.
        """
        try:
            if not account_id.startswith('act_'):
                account_id = f'act_{account_id}'
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{account_id}"
            params = {
                "access_token": self.access_token,
                "fields": "spend_cap,amount_spent,min_campaign_group_spend_cap"
            }
            
            response = httpx.get(url, params=params, timeout=30.0)
            
            if response.is_success:
                return {"success": True, "spend_cap": response.json()}
            else:
                error_data = response.json()
                return {
                    "success": False,
                    "error": error_data.get("error", {}).get("message", "Failed to get spend cap")
                }
                
        except Exception as e:
            logger.error(f"Get spend cap history error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_spend_cap_history(self, account_id: str) -> Dict[str, Any]:
        """
        Get spend cap history for an ad account.
        
        Args:
            account_id: Ad Account ID
            
        Returns:
            Dict with spend cap info
        """
        return await asyncio.to_thread(self._get_spend_cap_history_sync, account_id)

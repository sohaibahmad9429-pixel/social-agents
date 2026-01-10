"""
Meta Business SDK Client
Centralized SDK client wrapper for Meta Business APIs (Facebook, Instagram, Marketing API)

Based on official Meta Business SDK documentation:
https://developers.facebook.com/docs/business-sdk/getting-started

Install: pip install facebook_business

This module provides:
- Core SDK initialization and session management
- Async wrappers for SDK sync calls
- Token switching support
- Unified error handling

NOTE: Domain-specific functionality has been extracted to separate service modules:

Facebook/Instagram (in src.services.platforms):
- pages_service.py - Facebook Pages (PagesService)
- ig_service.py - Instagram Publishing (IGService)
- comments_service.py - Comments/Engagement (CommentsService)

Ads/Marketing (in src.services.meta_ads):
- sdk_insights.py - Analytics/Reporting  
- sdk_catalogs.py - Product Catalogs
- sdk_automation_rules.py - Ad Automation
- sdk_ab_tests.py - A/B Testing
- sdk_settings.py - Account Settings

For ads/campaigns/adsets, use meta_ads_service.py
"""
import asyncio
import logging
from typing import Optional, Dict, Any, List
from functools import wraps

# Meta Business SDK imports
from facebook_business.api import FacebookAdsApi
from facebook_business.adobjects.user import User
from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.business import Business
from facebook_business.exceptions import FacebookRequestError

from ...config import settings

logger = logging.getLogger(__name__)

# API Version (matches Graph API version in docs)
META_API_VERSION = "v24.0"


class MetaSDKError(Exception):
    """Custom exception for Meta SDK errors with structured error info"""
    
    def __init__(
        self, 
        message: str, 
        code: Optional[int] = None, 
        subcode: Optional[int] = None,
        error_type: Optional[str] = None,
        fbtrace_id: Optional[str] = None
    ):
        super().__init__(message)
        self.message = message
        self.code = code
        self.subcode = subcode
        self.error_type = error_type
        self.fbtrace_id = fbtrace_id
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "message": self.message,
            "code": self.code,
            "subcode": self.subcode,
            "error_type": self.error_type,
            "fbtrace_id": self.fbtrace_id
        }
    
    @classmethod
    def from_facebook_error(cls, error: FacebookRequestError) -> "MetaSDKError":
        """Create MetaSDKError from FacebookRequestError"""
        return cls(
            message=error.api_error_message() or str(error),
            code=error.api_error_code(),
            subcode=error.api_error_subcode(),
            error_type=error.api_error_type(),
            fbtrace_id=error.api_transient_error()
        )


def async_sdk_call(func):
    """
    Decorator to run SDK sync calls in thread pool for async compatibility.
    Also handles error conversion to MetaSDKError.
    """
    @wraps(func)
    async def wrapper(*args, **kwargs):
        try:
            # Run sync SDK call in thread pool
            return await asyncio.to_thread(func, *args, **kwargs)
        except FacebookRequestError as e:
            error_details = {
                'message': e.api_error_message(),
                'code': e.api_error_code(),
                'type': e.api_error_type(),
                'subcode': e.api_error_subcode() if hasattr(e, 'api_error_subcode') else None,
                'user_title': e.get_message() if hasattr(e, 'get_message') else None,
                'body': str(e.body()) if hasattr(e, 'body') else None
            }
            logger.error(f"Meta SDK error details: {error_details}")
            raise MetaSDKError.from_facebook_error(e)
        except Exception as e:
            logger.error(f"Unexpected error in SDK call: {str(e)}", exc_info=True)
            raise MetaSDKError(message=str(e))
    return wrapper


class MetaSDKClient:
    """
    Meta Business SDK Client - Core Initialization
    
    Provides unified access to Meta APIs through domain-specific service modules.
    
    Usage:
        client = MetaSDKClient(access_token=token)
        
        # For Facebook/Instagram operations, use platforms services:
        from src.services.platforms import PagesService, IGService, CommentsService
        pages_svc = PagesService(token)
        ig_svc = IGService(token)
    """
    
    def __init__(
        self,
        app_id: Optional[str] = None,
        app_secret: Optional[str] = None,
        access_token: Optional[str] = None
    ):
        """
        Initialize Meta Business SDK client.
        
        Args:
            app_id: Facebook App ID (defaults to settings.FACEBOOK_APP_ID)
            app_secret: Facebook App Secret (defaults to settings.FACEBOOK_APP_SECRET)
            access_token: User or Page access token
        """
        self.app_id = app_id or settings.FACEBOOK_APP_ID
        self.app_secret = app_secret or settings.FACEBOOK_APP_SECRET
        self._access_token = access_token
        self._api: Optional[FacebookAdsApi] = None
        self._initialized = False
        
        if access_token:
            self._initialize_api(access_token)
    
    def _initialize_api(self, access_token: str) -> None:
        """Initialize or reinitialize the SDK API with a new token"""
        if not self.app_id or not self.app_secret:
            logger.warning("Facebook App credentials not configured")
            return
        
        try:
            FacebookAdsApi.init(
                app_id=self.app_id,
                app_secret=self.app_secret,
                access_token=access_token,
                api_version=META_API_VERSION
            )
            self._api = FacebookAdsApi.get_default_api()
            self._access_token = access_token
            self._initialized = True
            logger.info("Meta Business SDK initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Meta SDK: {e}")
            self._initialized = False
    
    def switch_access_token(self, access_token: str) -> None:
        """
        Switch to a different access token.
        
        Per Meta docs: https://developers.facebook.com/docs/business-sdk/common-scenarios/token-switch
        This is useful when managing multiple Pages or Ad Accounts.
        
        Args:
            access_token: New access token to use
        """
        self._initialize_api(access_token)
    
    @property
    def access_token(self) -> Optional[str]:
        """Get the current access token"""
        return self._access_token
    
    @property
    def is_initialized(self) -> bool:
        """Check if SDK is properly initialized"""
        return self._initialized and self._api is not None
    
    def _ensure_initialized(self) -> None:
        """Ensure SDK is initialized before making calls"""
        if not self.is_initialized:
            raise MetaSDKError(
                message="Meta SDK not initialized. Provide access token first.",
                code=0
            )
    
    # =========================================================================
    # BASIC ACCOUNT OPERATIONS (kept for backward compatibility)
    # =========================================================================
    
    @async_sdk_call
    def _get_ad_accounts_sync(self) -> List[Dict[str, Any]]:
        """Get ad accounts accessible to the user"""
        self._ensure_initialized()
        
        me = User(fbid='me')
        accounts = me.get_ad_accounts(fields=[
            'id', 'name', 'account_status', 'currency', 'timezone_name',
            'amount_spent', 'spend_cap', 'business'
        ])
        
        return [
            {
                'id': acc['id'],
                'name': acc.get('name'),
                'account_status': acc.get('account_status'),
                'currency': acc.get('currency'),
                'timezone_name': acc.get('timezone_name'),
                'amount_spent': acc.get('amount_spent'),
                'spend_cap': acc.get('spend_cap'),
                'business': acc.get('business')
            }
            for acc in accounts
        ]
    
    async def get_ad_accounts(self) -> List[Dict[str, Any]]:
        """Get all Ad Accounts accessible by the user"""
        return await self._get_ad_accounts_sync()
    
    @async_sdk_call
    def _get_businesses_sync(self) -> List[Dict[str, Any]]:
        """Get businesses accessible to the user"""
        self._ensure_initialized()
        
        me = User(fbid='me')
        businesses = me.get_businesses(fields=[
            'id', 'name', 'created_time', 'timezone_id', 'primary_page'
        ])
        
        return [
            {
                'id': biz['id'],
                'name': biz.get('name'),
                'created_time': biz.get('created_time'),
                'timezone_id': biz.get('timezone_id'),
                'primary_page': biz.get('primary_page')
            }
            for biz in businesses
        ]
    
    async def get_businesses(self) -> List[Dict[str, Any]]:
        """Get all Businesses accessible by the user"""
        return await self._get_businesses_sync()
    
    @async_sdk_call
    def _get_business_ad_accounts_sync(self, business_id: str) -> List[Dict[str, Any]]:
        """Get ad accounts for a specific business"""
        self._ensure_initialized()
        
        business = Business(fbid=business_id)
        accounts = business.get_owned_ad_accounts(fields=[
            'id', 'name', 'account_status', 'currency', 'timezone_name'
        ])
        
        return [
            {
                'id': acc['id'],
                'name': acc.get('name'),
                'account_status': acc.get('account_status'),
                'currency': acc.get('currency'),
                'timezone_name': acc.get('timezone_name')
            }
            for acc in accounts
        ]
    
    async def get_business_ad_accounts(self, business_id: str) -> List[Dict[str, Any]]:
        """Get Ad Accounts owned by a Business"""
        return await self._get_business_ad_accounts_sync(business_id)
    
    def create_batch(self):
        """
        Create a batch request object for multiple API calls.
        
        Per Meta docs: https://developers.facebook.com/docs/business-sdk/batch-requests
        """
        self._ensure_initialized()
        return self._api.new_batch()


# =============================================================================
# SINGLETON INSTANCE & FACTORY
# =============================================================================

_sdk_client: Optional[MetaSDKClient] = None


def get_meta_sdk_client(access_token: Optional[str] = None) -> MetaSDKClient:
    """
    Get or create MetaSDKClient singleton.
    
    If access_token is provided, switches to that token.
    
    Args:
        access_token: Optional access token to use
        
    Returns:
        MetaSDKClient instance
    """
    global _sdk_client
    
    if _sdk_client is None:
        _sdk_client = MetaSDKClient(access_token=access_token)
    elif access_token:
        _sdk_client.switch_access_token(access_token)
    
    return _sdk_client


def create_meta_sdk_client(access_token: str) -> MetaSDKClient:
    """
    Create a new MetaSDKClient instance with specific token.
    
    Use this when you need isolated clients (e.g., for different users).
    
    Args:
        access_token: Access token for this client
        
    Returns:
        New MetaSDKClient instance
    """
    return MetaSDKClient(access_token=access_token)

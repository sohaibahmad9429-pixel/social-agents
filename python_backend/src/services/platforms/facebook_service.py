"""
Facebook Pages Service
Meta Business SDK - Facebook Page operations

Provides:
- Page management: get pages, page info
- Content publishing: posts, photos, videos
- Feed management: get posts

Uses facebook_business SDK for API calls.
"""
import asyncio
import logging
import hmac
import hashlib
from typing import Optional, Dict, Any, List

from facebook_business.adobjects.page import Page
from facebook_business.exceptions import FacebookRequestError

from ...config import settings

logger = logging.getLogger(__name__)

# API Version
META_API_VERSION = "v24.0"


class FacebookService:
    """Service for Facebook Page operations using Meta SDK."""
    
    def __init__(self, access_token: str, app_secret: Optional[str] = None):
        """
        Initialize Facebook Service.
        
        Args:
            access_token: User or Page access token
            app_secret: App secret for appsecret_proof (optional, defaults to settings)
        """
        self.access_token = access_token
        self.app_secret = app_secret or settings.FACEBOOK_CLIENT_SECRET
    
    def _init_api(self):
        """Initialize the SDK API"""
        from facebook_business.api import FacebookAdsApi
        FacebookAdsApi.init(
            app_id=settings.FACEBOOK_APP_ID,
            app_secret=settings.FACEBOOK_APP_SECRET,
            access_token=self.access_token,
            api_version=META_API_VERSION
        )
    
    def _get_appsecret_proof(self) -> str:
        """Calculate appsecret_proof = HMAC-SHA256(access_token, app_secret)"""
        if not self.app_secret:
            return ""
        return hmac.new(
            self.app_secret.encode('utf-8'),
            self.access_token.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    
    # =========================================================================
    # PAGE MANAGEMENT
    # =========================================================================
    
    def _get_user_pages_sync(self) -> Dict[str, Any]:
        """Get user's pages using direct HTTP call with v24 API."""
        try:
            import httpx
            
            appsecret_proof = self._get_appsecret_proof()
            
            url = f"https://graph.facebook.com/v24.0/me/accounts"
            params = {
                'access_token': self.access_token,
                'fields': 'id,name,access_token,category,instagram_business_account,picture'
            }
            if appsecret_proof:
                params['appsecret_proof'] = appsecret_proof
            
            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, params=params)
                
                if not response.is_success:
                    error_data = response.json() if response.content else {}
                    error_msg = error_data.get('error', {}).get('message', f'HTTP {response.status_code}')
                    return {"success": False, "error": error_msg}
                
                data = response.json()
                pages = data.get('data', [])
                
                result = [
                    {
                        'id': page['id'],
                        'name': page.get('name'),
                        'access_token': page.get('access_token'),
                        'category': page.get('category'),
                        'instagram_business_account': page.get('instagram_business_account'),
                        'picture': page.get('picture', {}).get('data', {}).get('url')
                    }
                    for page in pages
                ]
                
                return {"success": True, "pages": result}
                
        except Exception as e:
            logger.error(f"Get user pages error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_user_pages(self) -> Dict[str, Any]:
        """
        Get Facebook Pages managed by the user.
        
        Returns:
            Dict with success status and list of Page objects
        """
        return await asyncio.to_thread(self._get_user_pages_sync)
    
    def _get_page_info_sync(self, page_id: str) -> Dict[str, Any]:
        """Get info about a specific Page"""
        try:
            self._init_api()
            
            page = Page(fbid=page_id)
            page.api_get(fields=[
                'id', 'name', 'about', 'category', 'fan_count',
                'picture', 'instagram_business_account'
            ])
            
            return {
                "success": True,
                "page": {
                    'id': page['id'],
                    'name': page.get('name'),
                    'about': page.get('about'),
                    'category': page.get('category'),
                    'fan_count': page.get('fan_count'),
                    'picture': page.get('picture', {}).get('data', {}).get('url'),
                    'instagram_business_account': page.get('instagram_business_account')
                }
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Get page info error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_page_info(self, page_id: str) -> Dict[str, Any]:
        """Get information about a specific Facebook Page."""
        return await asyncio.to_thread(self._get_page_info_sync, page_id)
    
    # =========================================================================
    # CONTENT PUBLISHING
    # =========================================================================
    
    def _post_to_page_sync(
        self, 
        page_id: str, 
        message: str,
        link: Optional[str] = None,
        published: bool = True,
        scheduled_publish_time: Optional[int] = None
    ) -> Dict[str, Any]:
        """Post to Facebook Page feed."""
        try:
            self._init_api()
            
            page = Page(fbid=page_id)
            params = {'message': message}
            
            if link:
                params['link'] = link
            if not published:
                params['published'] = False
                if scheduled_publish_time:
                    params['scheduled_publish_time'] = scheduled_publish_time
            
            result = page.create_feed(**params)
            return {
                "success": True,
                'id': result.get('id'),
                'post_id': result.get('id')
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Post to page error: {e}")
            return {"success": False, "error": str(e)}
    
    async def post_to_page(
        self, 
        page_id: str, 
        message: str,
        link: Optional[str] = None,
        published: bool = True,
        scheduled_publish_time: Optional[int] = None
    ) -> Dict[str, Any]:
        """Publish a text/link post to a Facebook Page."""
        return await asyncio.to_thread(
            self._post_to_page_sync, page_id, message, link, published, scheduled_publish_time
        )
    
    def _post_photo_to_page_sync(
        self, 
        page_id: str, 
        photo_url: str,
        caption: Optional[str] = None,
        published: bool = True
    ) -> Dict[str, Any]:
        """Post photo to Facebook Page."""
        try:
            self._init_api()
            
            page = Page(fbid=page_id)
            params = {'url': photo_url}
            if caption:
                params['caption'] = caption
            if not published:
                params['published'] = False
                
            result = page.create_photo(**params)
            return {
                "success": True,
                'id': result.get('id'),
                'photo_id': result.get('id'),
                'post_id': result.get('post_id')
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Post photo to page error: {e}")
            return {"success": False, "error": str(e)}
    
    async def post_photo_to_page(
        self, 
        page_id: str, 
        photo_url: str,
        caption: Optional[str] = None,
        published: bool = True
    ) -> Dict[str, Any]:
        """Publish a photo to a Facebook Page."""
        return await asyncio.to_thread(
            self._post_photo_to_page_sync, page_id, photo_url, caption, published
        )
    
    def _post_video_to_page_sync(
        self, 
        page_id: str, 
        video_url: str,
        description: Optional[str] = None,
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        """Post video to Facebook Page."""
        try:
            self._init_api()
            
            page = Page(fbid=page_id)
            params = {'file_url': video_url}
            if description:
                params['description'] = description
            if title:
                params['title'] = title
                
            result = page.create_video(**params)
            return {
                "success": True,
                'id': result.get('id'),
                'video_id': result.get('id')
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Post video to page error: {e}")
            return {"success": False, "error": str(e)}
    
    async def post_video_to_page(
        self, 
        page_id: str, 
        video_url: str,
        description: Optional[str] = None,
        title: Optional[str] = None
    ) -> Dict[str, Any]:
        """Publish a video to a Facebook Page."""
        return await asyncio.to_thread(
            self._post_video_to_page_sync, page_id, video_url, description, title
        )
    
    # =========================================================================
    # FEED MANAGEMENT
    # =========================================================================
    
    def _get_page_feed_sync(self, page_id: str, limit: int = 10) -> Dict[str, Any]:
        """Get Facebook Page feed posts"""
        try:
            self._init_api()
            
            page = Page(fbid=page_id)
            posts = page.get_feed(
                fields=[
                    'id', 'message', 'created_time', 'permalink_url',
                    'comments.summary(true)', 'shares'
                ],
                params={'limit': limit}
            )
            
            return {
                "success": True,
                "posts": [dict(p) for p in posts]
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Get page feed error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_page_feed(self, page_id: str, limit: int = 10) -> Dict[str, Any]:
        """Get Facebook Page feed posts."""
        return await asyncio.to_thread(self._get_page_feed_sync, page_id, limit)


# Singleton instance
_facebook_service: Optional[FacebookService] = None


def facebook_service(access_token: str) -> FacebookService:
    """Get or create FacebookService instance."""
    global _facebook_service
    if _facebook_service is None or _facebook_service.access_token != access_token:
        _facebook_service = FacebookService(access_token)
    return _facebook_service


async def close_facebook_service():
    """Close/cleanup Facebook service (placeholder for future cleanup)."""
    global _facebook_service
    _facebook_service = None

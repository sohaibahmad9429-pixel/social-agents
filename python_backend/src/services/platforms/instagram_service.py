"""
Instagram Service
Meta Business SDK - Instagram Graph API

Provides:
- Account management: linked accounts, profile info
- Content publishing: posts, reels, stories, carousels
- Media management: get posts, check status

Uses facebook_business SDK for API calls.
"""
import asyncio
import logging
from typing import Optional, Dict, Any, List

from facebook_business.adobjects.page import Page
from facebook_business.adobjects.iguser import IGUser
from facebook_business.exceptions import FacebookRequestError

from ...config import settings

logger = logging.getLogger(__name__)

# API Version
META_API_VERSION = "v24.0"

# Media type constants
INSTAGRAM_MEDIA_TYPES = ["IMAGE", "VIDEO", "REELS", "STORIES", "CAROUSEL"]


class InstagramService:
    """Service for Instagram Business Account operations using Meta SDK."""
    
    def __init__(self, access_token: str):
        """
        Initialize Instagram Service.
        
        Args:
            access_token: User or Page access token with Instagram permissions
        """
        self.access_token = access_token
    
    def _init_api(self):
        """Initialize the SDK API"""
        from facebook_business.api import FacebookAdsApi
        FacebookAdsApi.init(
            app_id=settings.FACEBOOK_APP_ID,
            app_secret=settings.FACEBOOK_APP_SECRET,
            access_token=self.access_token,
            api_version=META_API_VERSION
        )
    
    # =========================================================================
    # ACCOUNT MANAGEMENT
    # =========================================================================
    
    def _get_instagram_account_sync(self, page_id: str) -> Dict[str, Any]:
        """Get Instagram Business Account linked to a Page"""
        try:
            self._init_api()
            
            page = Page(fbid=page_id)
            page.api_get(fields=['instagram_business_account'])
            
            ig_account = page.get('instagram_business_account')
            if not ig_account:
                return {
                    "success": True,
                    "instagram_account": None,
                    "message": "No Instagram Business Account linked to this page"
                }
            
            ig_user = IGUser(fbid=ig_account['id'])
            ig_user.api_get(fields=[
                'id', 'username', 'name', 'profile_picture_url',
                'followers_count', 'media_count'
            ])
            
            return {
                "success": True,
                "instagram_account": {
                    'id': ig_user['id'],
                    'username': ig_user.get('username'),
                    'name': ig_user.get('name'),
                    'profile_picture_url': ig_user.get('profile_picture_url'),
                    'followers_count': ig_user.get('followers_count'),
                    'media_count': ig_user.get('media_count')
                }
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Get Instagram account error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_instagram_account(self, page_id: str) -> Dict[str, Any]:
        """Get Instagram Business Account linked to a Facebook Page."""
        return await asyncio.to_thread(self._get_instagram_account_sync, page_id)
    
    # =========================================================================
    # CONTENT PUBLISHING
    # =========================================================================
    
    def _create_media_container_sync(
        self,
        ig_user_id: str,
        image_url: Optional[str] = None,
        video_url: Optional[str] = None,
        caption: Optional[str] = None,
        media_type: Optional[str] = None,
        is_carousel_item: bool = False,
        share_to_feed: bool = True
    ) -> Dict[str, Any]:
        """Create Instagram media container (Step 1 of publishing)."""
        try:
            self._init_api()
            
            ig_user = IGUser(fbid=ig_user_id)
            params = {}
            
            if image_url:
                params['image_url'] = image_url
            if video_url:
                params['video_url'] = video_url
            if caption:
                params['caption'] = caption
            if media_type:
                params['media_type'] = media_type
            if is_carousel_item:
                params['is_carousel_item'] = True
            if media_type == 'REELS':
                params['share_to_feed'] = share_to_feed
            
            result = ig_user.create_media(params=params)
            return {
                "success": True,
                'container_id': result.get('id'),
                'id': result.get('id')
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Create Instagram media container error: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_media_container(
        self,
        ig_user_id: str,
        image_url: Optional[str] = None,
        video_url: Optional[str] = None,
        caption: Optional[str] = None,
        media_type: Optional[str] = None,
        is_carousel_item: bool = False,
        share_to_feed: bool = True
    ) -> Dict[str, Any]:
        """Create Instagram media container (Step 1)."""
        return await asyncio.to_thread(
            self._create_media_container_sync,
            ig_user_id, image_url, video_url, caption, media_type, is_carousel_item, share_to_feed
        )
    
    def _create_carousel_container_sync(
        self,
        ig_user_id: str,
        children: List[str],
        caption: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create Instagram carousel container."""
        try:
            self._init_api()
            
            ig_user = IGUser(fbid=ig_user_id)
            params = {
                'media_type': 'CAROUSEL',
                'children': children
            }
            if caption:
                params['caption'] = caption
            
            result = ig_user.create_media(params=params)
            return {
                "success": True,
                'container_id': result.get('id'),
                'id': result.get('id')
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Create Instagram carousel container error: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_carousel_container(
        self,
        ig_user_id: str,
        children: List[str],
        caption: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create Instagram carousel container."""
        return await asyncio.to_thread(
            self._create_carousel_container_sync, ig_user_id, children, caption
        )
    
    def _publish_media_sync(self, ig_user_id: str, creation_id: str) -> Dict[str, Any]:
        """Publish Instagram media container (Step 2)."""
        try:
            self._init_api()
            
            ig_user = IGUser(fbid=ig_user_id)
            result = ig_user.create_media_publish(params={'creation_id': creation_id})
            return {
                "success": True,
                'id': result.get('id'),
                'media_id': result.get('id')
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Publish Instagram media error: {e}")
            return {"success": False, "error": str(e)}
    
    async def publish_media(self, ig_user_id: str, creation_id: str) -> Dict[str, Any]:
        """Publish Instagram media container (Step 2)."""
        return await asyncio.to_thread(self._publish_media_sync, ig_user_id, creation_id)
    
    # =========================================================================
    # MEDIA MANAGEMENT
    # =========================================================================
    
    def _get_container_status_sync(self, container_id: str) -> Dict[str, Any]:
        """Check status of Instagram media container"""
        try:
            self._init_api()
            
            from facebook_business.adobjects.igmedia import IGMedia
            container = IGMedia(fbid=container_id)
            container.api_get(fields=['id', 'status', 'status_code'])
            
            return {
                "success": True,
                'id': container.get('id'),
                'status': container.get('status'),
                'status_code': container.get('status_code')
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Get Instagram container status error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_container_status(self, container_id: str) -> Dict[str, Any]:
        """Check the processing status of an Instagram container."""
        return await asyncio.to_thread(self._get_container_status_sync, container_id)
    
    def _get_media_sync(self, ig_user_id: str, limit: int = 10) -> Dict[str, Any]:
        """Get Instagram media posts for a user"""
        try:
            self._init_api()
            
            ig_user = IGUser(fbid=ig_user_id)
            media = ig_user.get_media(
                fields=[
                    'id', 'caption', 'timestamp', 'comments_count', 
                    'like_count', 'media_type', 'permalink'
                ],
                params={'limit': limit}
            )
            
            return {
                "success": True,
                "media": [dict(m) for m in media]
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Get Instagram media error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_media(self, ig_user_id: str, limit: int = 10) -> Dict[str, Any]:
        """Get Instagram media posts for a business account."""
        return await asyncio.to_thread(self._get_media_sync, ig_user_id, limit)


# Singleton instance
_instagram_service: Optional[InstagramService] = None


def instagram_service(access_token: str) -> InstagramService:
    """Get or create InstagramService instance."""
    global _instagram_service
    if _instagram_service is None or _instagram_service.access_token != access_token:
        _instagram_service = InstagramService(access_token)
    return _instagram_service


async def close_instagram_service():
    """Close/cleanup Instagram service (placeholder for future cleanup)."""
    global _instagram_service
    _instagram_service = None

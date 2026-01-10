"""
SDK Instagram Service
Meta Business SDK - Instagram Graph API

Uses:
- facebook_business.adobjects.iguser
- facebook_business.adobjects.igmedia
- Instagram Business Account operations: posts, reels, stories, carousels
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
            
            # Get more details about the IG account
            ig_user = IGUser(fbid=ig_account['id'])
            ig_user.api_get(fields=[
                'id',
                'username',
                'name',
                'profile_picture_url',
                'followers_count',
                'media_count'
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
        """
        Get Instagram Business Account linked to a Facebook Page.
        
        Args:
            page_id: Facebook Page ID
            
        Returns:
            Dict with Instagram account info including id, username, followers_count
        """
        return await asyncio.to_thread(self._get_instagram_account_sync, page_id)
    
    def _create_instagram_media_container_sync(
        self,
        ig_user_id: str,
        image_url: Optional[str] = None,
        video_url: Optional[str] = None,
        caption: Optional[str] = None,
        media_type: Optional[str] = None,
        is_carousel_item: bool = False,
        share_to_feed: bool = True
    ) -> Dict[str, Any]:
        """
        Create Instagram media container (Step 1 of publishing).
        Per docs: POST /IG_ID/media with image_url or video_url
        """
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
                params['media_type'] = media_type  # VIDEO, REELS, STORIES, CAROUSEL
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
    
    async def create_instagram_media_container(
        self,
        ig_user_id: str,
        image_url: Optional[str] = None,
        video_url: Optional[str] = None,
        caption: Optional[str] = None,
        media_type: Optional[str] = None,
        is_carousel_item: bool = False,
        share_to_feed: bool = True
    ) -> Dict[str, Any]:
        """
        Create Instagram media container (Step 1).
        
        Args:
            ig_user_id: Instagram Business Account ID
            image_url: URL of image (for image posts)
            video_url: URL of video (for video/reels/stories)
            caption: Post caption
            media_type: VIDEO, REELS, STORIES, or CAROUSEL
            is_carousel_item: True if part of carousel
            share_to_feed: For reels, whether to also share to feed
            
        Returns:
            Dict with container_id
        """
        return await asyncio.to_thread(
            self._create_instagram_media_container_sync,
            ig_user_id,
            image_url,
            video_url,
            caption,
            media_type,
            is_carousel_item,
            share_to_feed
        )
    
    def _create_instagram_carousel_container_sync(
        self,
        ig_user_id: str,
        children: List[str],
        caption: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create Instagram carousel container.
        Per docs: POST /IG_ID/media with media_type=CAROUSEL and children
        """
        try:
            self._init_api()
            
            ig_user = IGUser(fbid=ig_user_id)
            params = {
                'media_type': 'CAROUSEL',
                'children': children  # List of container IDs
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
    
    async def create_instagram_carousel_container(
        self,
        ig_user_id: str,
        children: List[str],
        caption: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create Instagram carousel container.
        
        Args:
            ig_user_id: Instagram Business Account ID
            children: List of container IDs (2-10 items)
            caption: Carousel caption
            
        Returns:
            Dict with container_id
        """
        return await asyncio.to_thread(
            self._create_instagram_carousel_container_sync,
            ig_user_id,
            children,
            caption
        )
    
    def _publish_instagram_media_sync(
        self,
        ig_user_id: str,
        creation_id: str
    ) -> Dict[str, Any]:
        """
        Publish Instagram media container (Step 2).
        Per docs: POST /IG_ID/media_publish with creation_id
        """
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
    
    async def publish_instagram_media(
        self,
        ig_user_id: str,
        creation_id: str
    ) -> Dict[str, Any]:
        """
        Publish Instagram media container (Step 2).
        
        Args:
            ig_user_id: Instagram Business Account ID
            creation_id: Container ID from create step
            
        Returns:
            Dict with media_id (the published post ID)
        """
        return await asyncio.to_thread(
            self._publish_instagram_media_sync,
            ig_user_id,
            creation_id
        )
    
    def _get_instagram_container_status_sync(
        self,
        container_id: str
    ) -> Dict[str, Any]:
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
    
    async def get_instagram_container_status(self, container_id: str) -> Dict[str, Any]:
        """
        Check the processing status of an Instagram container.
        
        Args:
            container_id: Container ID to check
            
        Returns:
            Dict with status (FINISHED, IN_PROGRESS, ERROR)
        """
        return await asyncio.to_thread(
            self._get_instagram_container_status_sync,
            container_id
        )
    
    def _get_instagram_media_sync(
        self, 
        ig_user_id: str, 
        limit: int = 10
    ) -> Dict[str, Any]:
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
    
    async def get_instagram_media(
        self, 
        ig_user_id: str, 
        limit: int = 10
    ) -> Dict[str, Any]:
        """
        Get Instagram media posts for a business account.
        
        Args:
            ig_user_id: Instagram Business User ID
            limit: Max posts to fetch
            
        Returns:
            Dict with list of media objects with id, caption, comments_count, etc.
        """
        return await asyncio.to_thread(
            self._get_instagram_media_sync,
            ig_user_id,
            limit
        )


# Media type constants
INSTAGRAM_MEDIA_TYPES = [
    "IMAGE",
    "VIDEO",
    "REELS",
    "STORIES",
    "CAROUSEL"
]

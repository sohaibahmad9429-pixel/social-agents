"""
Engagement Service
Meta Graph API - Comments and Engagement for Facebook/Instagram

Provides:
- Comments: get, reply, delete, hide
- Likes: like, unlike
- Works for both Facebook and Instagram content

Uses direct Graph API calls via httpx.
"""
import asyncio
import logging
import hmac
import hashlib
from typing import Optional, Dict, Any

import httpx

from ...config import settings

logger = logging.getLogger(__name__)

# API Version
META_API_VERSION = "v24.0"


class EngagementService:
    """Service for comments and engagement on Facebook/Instagram."""
    
    def __init__(self, access_token: str, app_secret: Optional[str] = None):
        """
        Initialize Engagement Service.
        
        Args:
            access_token: User or Page access token
            app_secret: App secret for appsecret_proof (optional)
        """
        self.access_token = access_token
        self.app_secret = app_secret or settings.FACEBOOK_CLIENT_SECRET
    
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
    # COMMENTS
    # =========================================================================
    
    def _get_comments_sync(
        self, 
        object_id: str, 
        limit: int = 50,
        fields: str = "id,text,from,timestamp,like_count"
    ) -> Dict[str, Any]:
        """Get comments for any object (post, photo, video)"""
        try:
            appsecret_proof = self._get_appsecret_proof()
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{object_id}/comments"
            params = {
                "fields": fields,
                "limit": limit,
                "access_token": self.access_token
            }
            if appsecret_proof:
                params["appsecret_proof"] = appsecret_proof
            
            with httpx.Client(timeout=30.0) as client:
                resp = client.get(url, params=params)
                if resp.is_success:
                    data = resp.json()
                    return {
                        "success": True,
                        "comments": data.get("data", []),
                        "paging": data.get("paging")
                    }
                else:
                    error_data = resp.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Failed to get comments")
                    }
                    
        except Exception as e:
            logger.error(f"Get comments error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_comments(
        self, 
        object_id: str, 
        limit: int = 50,
        fields: str = "id,text,from,timestamp,like_count"
    ) -> Dict[str, Any]:
        """Get comments for any object (post, media, photo)."""
        return await asyncio.to_thread(self._get_comments_sync, object_id, limit, fields)
    
    def _reply_to_comment_sync(self, comment_id: str, message: str) -> Dict[str, Any]:
        """Reply to a comment"""
        try:
            appsecret_proof = self._get_appsecret_proof()
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{comment_id}/replies"
            data = {"message": message, "access_token": self.access_token}
            if appsecret_proof:
                data["appsecret_proof"] = appsecret_proof
            
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(url, data=data)
                if resp.is_success:
                    result = resp.json()
                    return {"success": True, "id": result.get("id")}
                else:
                    error_data = resp.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Failed to reply")
                    }
                    
        except Exception as e:
            logger.error(f"Reply to comment error: {e}")
            return {"success": False, "error": str(e)}
    
    async def reply_to_comment(self, comment_id: str, message: str) -> Dict[str, Any]:
        """Reply to a comment on Facebook or Instagram."""
        return await asyncio.to_thread(self._reply_to_comment_sync, comment_id, message)
    
    def _delete_comment_sync(self, comment_id: str) -> Dict[str, Any]:
        """Delete a comment"""
        try:
            appsecret_proof = self._get_appsecret_proof()
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{comment_id}"
            params = {"access_token": self.access_token}
            if appsecret_proof:
                params["appsecret_proof"] = appsecret_proof
            
            with httpx.Client(timeout=30.0) as client:
                resp = client.delete(url, params=params)
                if resp.is_success:
                    return {"success": True}
                else:
                    error_data = resp.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Failed to delete")
                    }
                    
        except Exception as e:
            logger.error(f"Delete comment error: {e}")
            return {"success": False, "error": str(e)}
    
    async def delete_comment(self, comment_id: str) -> Dict[str, Any]:
        """Delete a comment."""
        return await asyncio.to_thread(self._delete_comment_sync, comment_id)
    
    def _hide_comment_sync(self, comment_id: str, is_hidden: bool = True) -> Dict[str, Any]:
        """Hide or unhide a comment"""
        try:
            appsecret_proof = self._get_appsecret_proof()
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{comment_id}"
            data = {
                "access_token": self.access_token,
                "is_hidden": "true" if is_hidden else "false"
            }
            if appsecret_proof:
                data["appsecret_proof"] = appsecret_proof
            
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(url, data=data)
                if resp.is_success:
                    return {"success": True, "is_hidden": is_hidden}
                else:
                    error_data = resp.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Failed to hide")
                    }
                    
        except Exception as e:
            logger.error(f"Hide comment error: {e}")
            return {"success": False, "error": str(e)}
    
    async def hide_comment(self, comment_id: str, is_hidden: bool = True) -> Dict[str, Any]:
        """Hide or unhide a comment."""
        return await asyncio.to_thread(self._hide_comment_sync, comment_id, is_hidden)
    
    # =========================================================================
    # LIKES
    # =========================================================================
    
    def _like_object_sync(self, object_id: str) -> Dict[str, Any]:
        """Like a comment or post"""
        try:
            appsecret_proof = self._get_appsecret_proof()
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{object_id}/likes"
            data = {"access_token": self.access_token}
            if appsecret_proof:
                data["appsecret_proof"] = appsecret_proof
            
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(url, data=data)
                if resp.is_success:
                    return {"success": True}
                else:
                    error_data = resp.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Failed to like")
                    }
                    
        except Exception as e:
            logger.error(f"Like object error: {e}")
            return {"success": False, "error": str(e)}
    
    async def like_object(self, object_id: str) -> Dict[str, Any]:
        """Like a comment or post."""
        return await asyncio.to_thread(self._like_object_sync, object_id)
    
    def _unlike_object_sync(self, object_id: str) -> Dict[str, Any]:
        """Unlike a comment or post"""
        try:
            appsecret_proof = self._get_appsecret_proof()
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{object_id}/likes"
            params = {"access_token": self.access_token}
            if appsecret_proof:
                params["appsecret_proof"] = appsecret_proof
            
            with httpx.Client(timeout=30.0) as client:
                resp = client.delete(url, params=params)
                if resp.is_success:
                    return {"success": True}
                else:
                    error_data = resp.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Failed to unlike")
                    }
                    
        except Exception as e:
            logger.error(f"Unlike object error: {e}")
            return {"success": False, "error": str(e)}
    
    async def unlike_object(self, object_id: str) -> Dict[str, Any]:
        """Unlike a comment or post."""
        return await asyncio.to_thread(self._unlike_object_sync, object_id)


# Singleton instance
_engagement_service: Optional[EngagementService] = None


def engagement_service(access_token: str) -> EngagementService:
    """Get or create EngagementService instance."""
    global _engagement_service
    if _engagement_service is None or _engagement_service.access_token != access_token:
        _engagement_service = EngagementService(access_token)
    return _engagement_service


async def close_engagement_service():
    """Close/cleanup Engagement service."""
    global _engagement_service
    _engagement_service = None

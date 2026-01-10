"""
SDK Comments Service
Meta Business SDK - Comments/Engagement

Uses:
- Graph API for comments management
- Supports Facebook Pages and Instagram
- Reply to comments, like content
"""
import asyncio
import logging
import hmac
import hashlib
from typing import Optional, Dict, Any, List

from facebook_business.exceptions import FacebookRequestError

from ...config import settings

logger = logging.getLogger(__name__)

# API Version
META_API_VERSION = "v24.0"


class CommentsService:
    """Service for comments and engagement using Meta Graph API."""
    
    def __init__(self, access_token: str, app_secret: Optional[str] = None):
        """
        Initialize Comments Service.
        
        Args:
            access_token: User or Page access token
            app_secret: App secret for appsecret_proof (optional, defaults to settings)
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
    
    def _get_object_comments_sync(
        self, 
        object_id: str, 
        limit: int = 50,
        fields: str = "id,text,from,timestamp,like_count"
    ) -> Dict[str, Any]:
        """Get comments for any object (post, photo, video)"""
        try:
            import httpx
            
            appsecret_proof = self._get_appsecret_proof()
            
            fields_param = fields.replace(",", "%2C")
            url = f"https://graph.facebook.com/{META_API_VERSION}/{object_id}/comments"
            url += f"?fields={fields_param}&limit={limit}&access_token={self.access_token}"
            if appsecret_proof:
                url += f"&appsecret_proof={appsecret_proof}"
            
            with httpx.Client(timeout=30.0) as client:
                resp = client.get(url)
                if resp.is_success:
                    data = resp.json()
                    return {
                        "success": True,
                        "comments": data.get("data", []),
                        "paging": data.get("paging")
                    }
                else:
                    error_data = resp.json()
                    error_info = error_data.get("error", {})
                    return {
                        "success": False,
                        "error": error_info.get("message", "Failed to get comments")
                    }
                    
        except Exception as e:
            logger.error(f"Get object comments error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_object_comments(
        self, 
        object_id: str, 
        limit: int = 50,
        fields: str = "id,text,from,timestamp,like_count"
    ) -> Dict[str, Any]:
        """
        Get comments for any object (post, media, photo).
        
        Args:
            object_id: ID of the post/media
            limit: Max comments to fetch
            fields: Fields to retrieve
            
        Returns:
            Dict with list of comment objects
        """
        return await asyncio.to_thread(
            self._get_object_comments_sync,
            object_id,
            limit,
            fields
        )
    
    def _reply_to_comment_sync(
        self, 
        comment_id: str, 
        message: str
    ) -> Dict[str, Any]:
        """Reply to a comment"""
        try:
            import httpx
            
            appsecret_proof = self._get_appsecret_proof()
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{comment_id}/replies"
            
            data = {
                "message": message,
                "access_token": self.access_token,
            }
            if appsecret_proof:
                data["appsecret_proof"] = appsecret_proof
            
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(url, data=data)
                if resp.is_success:
                    result = resp.json()
                    return {
                        "success": True,
                        "id": result.get("id"),
                        "reply_id": result.get("id")
                    }
                else:
                    error_data = resp.json()
                    error_info = error_data.get("error", {})
                    return {
                        "success": False,
                        "error": error_info.get("message", "Failed to post reply")
                    }
                    
        except Exception as e:
            logger.error(f"Reply to comment error: {e}")
            return {"success": False, "error": str(e)}
    
    async def reply_to_comment(
        self, 
        comment_id: str, 
        message: str
    ) -> Dict[str, Any]:
        """
        Reply to a comment on Instagram or Facebook.
        
        Args:
            comment_id: Comment ID to reply to
            message: Reply message
            
        Returns:
            Dict with reply id
        """
        return await asyncio.to_thread(
            self._reply_to_comment_sync,
            comment_id,
            message
        )
    
    def _like_object_sync(self, object_id: str) -> Dict[str, Any]:
        """Like a comment or post"""
        try:
            import httpx
            
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
                    error_info = error_data.get("error", {})
                    return {
                        "success": False,
                        "error": error_info.get("message", "Failed to like")
                    }
                    
        except Exception as e:
            logger.error(f"Like object error: {e}")
            return {"success": False, "error": str(e)}
    
    async def like_object(self, object_id: str) -> Dict[str, Any]:
        """
        Like a comment or post.
        
        Args:
            object_id: ID of comment/post to like
            
        Returns:
            Dict with success status
        """
        return await asyncio.to_thread(
            self._like_object_sync,
            object_id
        )
    
    def _unlike_object_sync(self, object_id: str) -> Dict[str, Any]:
        """Unlike a comment or post"""
        try:
            import httpx
            
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
                    error_info = error_data.get("error", {})
                    return {
                        "success": False,
                        "error": error_info.get("message", "Failed to unlike")
                    }
                    
        except Exception as e:
            logger.error(f"Unlike object error: {e}")
            return {"success": False, "error": str(e)}
    
    async def unlike_object(self, object_id: str) -> Dict[str, Any]:
        """
        Unlike a comment or post.
        
        Args:
            object_id: ID of comment/post to unlike
            
        Returns:
            Dict with success status
        """
        return await asyncio.to_thread(
            self._unlike_object_sync,
            object_id
        )
    
    def _delete_comment_sync(self, comment_id: str) -> Dict[str, Any]:
        """Delete a comment"""
        try:
            import httpx
            
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
                    error_info = error_data.get("error", {})
                    return {
                        "success": False,
                        "error": error_info.get("message", "Failed to delete comment")
                    }
                    
        except Exception as e:
            logger.error(f"Delete comment error: {e}")
            return {"success": False, "error": str(e)}
    
    async def delete_comment(self, comment_id: str) -> Dict[str, Any]:
        """
        Delete a comment.
        
        Args:
            comment_id: Comment ID to delete
            
        Returns:
            Dict with success status
        """
        return await asyncio.to_thread(
            self._delete_comment_sync,
            comment_id
        )
    
    def _hide_comment_sync(self, comment_id: str, is_hidden: bool = True) -> Dict[str, Any]:
        """Hide or unhide a comment"""
        try:
            import httpx
            
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
                    error_info = error_data.get("error", {})
                    return {
                        "success": False,
                        "error": error_info.get("message", "Failed to hide comment")
                    }
                    
        except Exception as e:
            logger.error(f"Hide comment error: {e}")
            return {"success": False, "error": str(e)}
    
    async def hide_comment(self, comment_id: str, is_hidden: bool = True) -> Dict[str, Any]:
        """
        Hide or unhide a comment.
        
        Args:
            comment_id: Comment ID
            is_hidden: True to hide, False to unhide
            
        Returns:
            Dict with success status
        """
        return await asyncio.to_thread(
            self._hide_comment_sync,
            comment_id,
            is_hidden
        )

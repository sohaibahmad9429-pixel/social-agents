"""
TikTok Service
Production-ready TikTok API v2 client using OAuth 2.0
Handles video publishing and authentication
Uses tiktok-api-client library (latest 2025 version)
"""
import httpx
import asyncio
from typing import Optional, Dict, Any
from datetime import datetime

from ...config import settings


class TikTokService:
    """TikTok API service for video publishing"""
    
    # API Constants
    TIKTOK_OAUTH_URL = "https://www.tiktok.com/v2/auth/authorize/"
    TIKTOK_TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/"
    TIKTOK_USER_INFO_URL = "https://open.tiktokapis.com/v2/user/info/"
    TIKTOK_VIDEO_PUBLISH_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/"
    TIKTOK_PUBLISH_STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/"
    
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=120.0)  # Longer timeout for video uploads
    
    async def close(self):
        """Close HTTP client"""
        await self.http_client.aclose()
    
    # ============================================================================
    # TOKEN MANAGEMENT
    # ============================================================================
    
    async def refresh_access_token(
        self,
        refresh_token: str,
        client_key: str,
        client_secret: str
    ) -> Dict[str, Any]:
        """
        Refresh TikTok access token
        TikTok tokens expire in ~24 hours
        
        Args:
            refresh_token: Refresh token
            client_key: TikTok client key
            client_secret: TikTok client secret
            
        Returns:
            Dict with access_token, refresh_token, expires_in
        """
        try:
            response = await self.http_client.post(
                self.TIKTOK_TOKEN_URL,
                data={
                    'client_key': client_key,
                    'client_secret': client_secret,
                    'refresh_token': refresh_token,
                    'grant_type': 'refresh_token'
                },
                headers={'Content-Type': 'application/x-www-form-urlencoded'}
            )
            
            response.raise_for_status()
            data = response.json()
            
            return {
                'success': True,
                'access_token': data['access_token'],
                'refresh_token': data.get('refresh_token', refresh_token),
                'expires_in': data['expires_in']
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    # ============================================================================
    # USER INFO
    # ============================================================================
    
    async def get_user_info(self, access_token: str) -> Dict[str, Any]:
        """
        Get TikTok user profile information
        
        Args:
            access_token: Access token
            
        Returns:
            Dict with user info
        """
        try:
            response = await self.http_client.get(
                self.TIKTOK_USER_INFO_URL,
                params={'fields': 'open_id,union_id,display_name,avatar_url'},
                headers={'Authorization': f'Bearer {access_token}'}
            )
            
            response.raise_for_status()
            data = response.json()
            
            user_data = data.get('data', {}).get('user', {})
            
            return {
                'success': True,
                'open_id': user_data.get('open_id'),
                'union_id': user_data.get('union_id'),
                'display_name': user_data.get('display_name'),
                'avatar_url': user_data.get('avatar_url')
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    # ============================================================================
    # VIDEO PUBLISHING
    # ============================================================================
    
    async def init_video_publish(
        self,
        access_token: str,
        title: str,
        video_url: str,
        privacy_level: str = "SELF_ONLY"
    ) -> Dict[str, Any]:
        """
        Initialize video publish using PULL_FROM_URL method
        
        TikTok will pull the video from the provided URL
        Important: URL must be from a verified domain
        
        Args:
            access_token: Access token
            title: Video title/caption (max 2200 chars)
            video_url: Publicly accessible video URL
            privacy_level: Privacy level (PUBLIC_TO_EVERYONE, MUTUAL_FOLLOW_FRIENDS, SELF_ONLY)
            
        Returns:
            Dict with publish_id
        """
        try:
            body = {
                'post_info': {
                    'title': title,
                    'privacy_level': privacy_level,
                    'disable_comment': False,
                    'disable_duet': False,
                    'disable_stitch': False
                },
                'source_info': {
                    'source': 'PULL_FROM_URL',
                    'video_url': video_url
                }
            }
            
            response = await self.http_client.post(
                self.TIKTOK_VIDEO_PUBLISH_URL,
                json=body,
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json'
                }
            )
            
            response.raise_for_status()
            data = response.json()
            
            # Check for errors
            if data.get('error') and data['error'].get('code') and data['error']['code'] != 'ok':
                error_code = data['error'].get('code')
                error_message = data['error'].get('message')
                log_id = data['error'].get('log_id')
                
                return {
                    'success': False,
                    'error': f"TikTok API error: code={error_code}, message={error_message}, log_id={log_id}"
                }
            
            publish_id = data.get('data', {}).get('publish_id')
            
            if not publish_id:
                return {'success': False, 'error': 'No publish_id returned from TikTok'}
            
            return {
                'success': True,
                'publish_id': publish_id
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    async def init_video_publish_file_upload(
        self,
        access_token: str,
        title: str,
        video_size: int,
        privacy_level: str = "SELF_ONLY"
    ) -> Dict[str, Any]:
        """
        Initialize video publish using FILE_UPLOAD method
        
        Returns upload_url for chunked upload
        
        Args:
            access_token: Access token
            title: Video title/caption
            video_size: Video file size in bytes
            privacy_level: Privacy level
            
        Returns:
            Dict with publish_id and upload_url
        """
        try:
            chunk_size = min(video_size, 10000000)  # Max 10MB chunks
            total_chunks = (video_size + chunk_size - 1) // chunk_size
            
            body = {
                'post_info': {
                    'title': title,
                    'privacy_level': privacy_level,
                    'disable_comment': False,
                    'disable_duet': False,
                    'disable_stitch': False
                },
                'source_info': {
                    'source': 'FILE_UPLOAD',
                    'video_size': video_size,
                    'chunk_size': chunk_size,
                    'total_chunk_count': total_chunks
                }
            }
            
            response = await self.http_client.post(
                self.TIKTOK_VIDEO_PUBLISH_URL,
                json=body,
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json'
                }
            )
            
            response.raise_for_status()
            data = response.json()
            
            # Check for errors
            if data.get('error') and data['error'].get('code') and data['error']['code'] != 'ok':
                error_message = data['error'].get('message')
                return {'success': False, 'error': f"TikTok API error: {error_message}"}
            
            publish_id = data.get('data', {}).get('publish_id')
            upload_url = data.get('data', {}).get('upload_url')
            
            if not publish_id or not upload_url:
                return {'success': False, 'error': 'Missing publish_id or upload_url'}
            
            return {
                'success': True,
                'publish_id': publish_id,
                'upload_url': upload_url
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    async def check_publish_status(
        self,
        access_token: str,
        publish_id: str
    ) -> Dict[str, Any]:
        """
        Check video publish status
        
        Args:
            access_token: Access token
            publish_id: Publish ID from init_video_publish
            
        Returns:
            Dict with status
        """
        try:
            response = await self.http_client.post(
                self.TIKTOK_PUBLISH_STATUS_URL,
                json={'publish_id': publish_id},
                headers={
                    'Authorization': f'Bearer {access_token}',
                    'Content-Type': 'application/json'
                }
            )
            
            response.raise_for_status()
            data = response.json()
            
            status = data.get('data', {}).get('status', 'UNKNOWN')
            
            return {
                'success': True,
                'status': status,
                'publish_id': publish_id
            }
            
        except Exception as e:
            return {'success': False, 'error': str(e)}


# Singleton instance
tiktok_service = TikTokService()


# Helper function
async def close_tiktok_service():
    """Close TikTok service HTTP client"""
    await tiktok_service.close()

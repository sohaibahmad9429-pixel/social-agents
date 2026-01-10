"""Platform-specific services for social media platforms"""
from .linkedin_service import linkedin_service, close_linkedin_service
from .twitter_service import twitter_service, close_twitter_service
from .tiktok_service import tiktok_service, close_tiktok_service
from .youtube_service import youtube_service, close_youtube_service
from .facebook_service import facebook_service, close_facebook_service, FacebookService
from .instagram_service import instagram_service, close_instagram_service, InstagramService

# Meta SDK services (moved from meta_ads)
from .pages_service import PagesService
from .ig_service import InstagramService as IGService
from .comments_service import CommentsService

__all__ = [
    # LinkedIn
    "linkedin_service",
    "close_linkedin_service",
    # Twitter
    "twitter_service",
    "close_twitter_service",
    # TikTok
    "tiktok_service",
    "close_tiktok_service",
    # YouTube
    "youtube_service",
    "close_youtube_service",
    # Facebook
    "facebook_service",
    "close_facebook_service",
    "FacebookService",
    "PagesService",
    # Instagram
    "instagram_service",
    "close_instagram_service",
    "InstagramService",
    "IGService",
    # Comments/Engagement
    "CommentsService",
]


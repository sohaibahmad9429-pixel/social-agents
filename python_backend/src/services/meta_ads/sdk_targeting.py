"""
SDK Targeting Options Service
Meta Business SDK - Targeting

Uses:
- facebook_business.adobjects.targeting
- facebook_business.adobjects.targetingsearch
- Browse and search targeting options
"""
import asyncio
import logging
from typing import Optional, Dict, Any, List

from facebook_business.adobjects.adaccount import AdAccount
from facebook_business.adobjects.targetingsearch import TargetingSearch
from facebook_business.exceptions import FacebookRequestError

logger = logging.getLogger(__name__)


class TargetingService:
    """Service for targeting options using Meta SDK."""
    
    def __init__(self, access_token: str):
        self.access_token = access_token
    
    def _init_api(self):
        from facebook_business.api import FacebookAdsApi
        FacebookAdsApi.init(access_token=self.access_token, api_version="v24.0")
    
    def _search_targeting_sync(
        self,
        query: str,
        target_type: str = "adinterest",
        limit: int = 25
    ) -> Dict[str, Any]:
        """
        Search for targeting options.
        
        target_type options:
        - adinterest: Interests
        - adgeolocation: Locations
        - adeducationschool: Schools
        - adworkemployer: Employers
        - adworkposition: Job titles
        - adlocale: Languages
        """
        try:
            self._init_api()
            
            results = TargetingSearch.search(
                params={
                    "q": query,
                    "type": target_type,
                    "limit": limit
                }
            )
            
            options = []
            for item in results:
                options.append({
                    "id": item.get("id"),
                    "name": item.get("name"),
                    "type": item.get("type"),
                    "audience_size": item.get("audience_size"),
                    "path": item.get("path", []),
                    "description": item.get("description")
                })
            
            return {"success": True, "options": options}
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Targeting search error: {e}")
            return {"success": False, "error": str(e)}
    
    async def search_targeting(
        self,
        query: str,
        target_type: str = "adinterest",
        limit: int = 25
    ) -> Dict[str, Any]:
        """Async wrapper."""
        return await asyncio.to_thread(
            self._search_targeting_sync,
            query,
            target_type,
            limit
        )
    
    def _browse_targeting_sync(
        self,
        target_type: str = "adinterest",
        targeting_class: str = "interests"
    ) -> Dict[str, Any]:
        """
        Browse targeting categories.
        
        targeting_class options:
        - interests
        - behaviors
        - demographics
        - life_events
        - industries
        """
        try:
            self._init_api()
            
            results = TargetingSearch.search(
                params={
                    "type": target_type,
                    "class": targeting_class
                }
            )
            
            categories = []
            for item in results:
                categories.append({
                    "id": item.get("id"),
                    "name": item.get("name"),
                    "audience_size": item.get("audience_size"),
                    "path": item.get("path", []),
                    "type": item.get("type")
                })
            
            return {"success": True, "categories": categories}
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Targeting browse error: {e}")
            return {"success": False, "error": str(e)}
    
    async def browse_targeting(
        self,
        target_type: str = "adinterest",
        targeting_class: str = "interests"
    ) -> Dict[str, Any]:
        """Async wrapper."""
        return await asyncio.to_thread(
            self._browse_targeting_sync,
            target_type,
            targeting_class
        )
    
    def _get_geo_locations_sync(
        self,
        query: str,
        location_types: List[str] = None
    ) -> Dict[str, Any]:
        """Search for geo locations."""
        try:
            self._init_api()
            
            params = {
                "q": query,
                "type": "adgeolocation",
            }
            if location_types:
                params["location_types"] = location_types
            
            results = TargetingSearch.search(params=params)
            
            locations = []
            for item in results:
                locations.append({
                    "key": item.get("key"),
                    "name": item.get("name"),
                    "type": item.get("type"),
                    "country_code": item.get("country_code"),
                    "region": item.get("region"),
                    "supports_city": item.get("supports_city", False),
                    "supports_region": item.get("supports_region", False)
                })
            
            return {"success": True, "locations": locations}
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Geo location search error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_geo_locations(
        self,
        query: str,
        location_types: List[str] = None
    ) -> Dict[str, Any]:
        """Async wrapper."""
        return await asyncio.to_thread(
            self._get_geo_locations_sync,
            query,
            location_types
        )


# Targeting type constants
TARGETING_TYPES = {
    "interests": "adinterest",
    "behaviors": "adbehavior",
    "demographics": "addemographic",
    "locations": "adgeolocation",
    "schools": "adeducationschool",
    "employers": "adworkemployer",
    "job_titles": "adworkposition",
    "languages": "adlocale"
}

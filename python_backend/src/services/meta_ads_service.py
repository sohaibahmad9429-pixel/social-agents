"""
Meta Ads Service
Production-ready Meta Graph API v24.0 wrapper for campaign, ad set, and ad management.

Handles:
- API authentication with appsecret_proof
- Campaign CRUD operations
- Ad Set CRUD operations  
- Ad CRUD with creative uploads
- Audience fetching
- Business portfolio management
"""
import logging
import hmac
import hashlib
import httpx
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

from ..config import settings

logger = logging.getLogger(__name__)

# Meta API Configuration
META_API_VERSION = "v24.0"
META_API_BASE = f"https://graph.facebook.com/{META_API_VERSION}"

# Objective mapping from legacy to OUTCOME-based (API v24.0+)
OBJECTIVE_MAPPING: Dict[str, str] = {
    "LINK_CLICKS": "OUTCOME_TRAFFIC",
    "TRAFFIC": "OUTCOME_TRAFFIC",
    "CONVERSIONS": "OUTCOME_SALES",
    "SALES": "OUTCOME_SALES",
    "LEAD_GENERATION": "OUTCOME_LEADS",
    "LEADS": "OUTCOME_LEADS",
    "BRAND_AWARENESS": "OUTCOME_AWARENESS",
    "AWARENESS": "OUTCOME_AWARENESS",
    "REACH": "OUTCOME_AWARENESS",
    "POST_ENGAGEMENT": "OUTCOME_ENGAGEMENT",
    "ENGAGEMENT": "OUTCOME_ENGAGEMENT",
    "VIDEO_VIEWS": "OUTCOME_ENGAGEMENT",
    "PAGE_LIKES": "OUTCOME_ENGAGEMENT",
    "APP_INSTALLS": "OUTCOME_APP_PROMOTION",
    "APP_PROMOTION": "OUTCOME_APP_PROMOTION",
    "MESSAGES": "OUTCOME_ENGAGEMENT",
    # New objectives pass through
    "OUTCOME_TRAFFIC": "OUTCOME_TRAFFIC",
    "OUTCOME_SALES": "OUTCOME_SALES",
    "OUTCOME_LEADS": "OUTCOME_LEADS",
    "OUTCOME_AWARENESS": "OUTCOME_AWARENESS",
    "OUTCOME_ENGAGEMENT": "OUTCOME_ENGAGEMENT",
    "OUTCOME_APP_PROMOTION": "OUTCOME_APP_PROMOTION",
}

# Valid optimization goals per objective - v24.0 ODAX
OBJECTIVE_VALID_GOALS: Dict[str, List[str]] = {
    "OUTCOME_AWARENESS": ["REACH", "IMPRESSIONS", "AD_RECALL_LIFT"],
    "OUTCOME_TRAFFIC": ["LINK_CLICKS", "LANDING_PAGE_VIEWS", "REACH", "IMPRESSIONS"],
    "OUTCOME_ENGAGEMENT": ["POST_ENGAGEMENT", "THRUPLAY", "VIDEO_VIEWS", "TWO_SECOND_CONTINUOUS_VIDEO_VIEWS", "LINK_CLICKS", "PAGE_LIKES", "EVENT_RESPONSES", "CONVERSATIONS"],
    "OUTCOME_LEADS": ["LEAD_GENERATION", "QUALITY_LEAD", "CONVERSATIONS", "LINK_CLICKS", "OFFSITE_CONVERSIONS", "ONSITE_CONVERSIONS"],
    "OUTCOME_SALES": ["LINK_CLICKS", "LANDING_PAGE_VIEWS", "OFFSITE_CONVERSIONS", "ONSITE_CONVERSIONS", "VALUE"],
    "OUTCOME_APP_PROMOTION": ["APP_INSTALLS", "APP_INSTALLS_AND_OFFSITE_CONVERSIONS", "LINK_CLICKS", "REACH"],
}

# Optimization goal to billing event mapping
OPTIMIZATION_TO_BILLING: Dict[str, str] = {
    "REACH": "IMPRESSIONS",
    "IMPRESSIONS": "IMPRESSIONS",
    "LINK_CLICKS": "IMPRESSIONS",
    "LANDING_PAGE_VIEWS": "IMPRESSIONS",
    "POST_ENGAGEMENT": "IMPRESSIONS",
    "VIDEO_VIEWS": "IMPRESSIONS",
    "THRUPLAY": "IMPRESSIONS",
    "LEAD_GENERATION": "IMPRESSIONS",
    "OFFSITE_CONVERSIONS": "IMPRESSIONS",
    "APP_INSTALLS": "IMPRESSIONS",
    "CONVERSATIONS": "IMPRESSIONS",
    "QUALITY_CALL": "IMPRESSIONS",
    "QUALITY_LEAD": "IMPRESSIONS",
    "VALUE": "IMPRESSIONS",
}


class MetaAdsService:
    """
    Production Meta Ads API service
    
    Provides methods for:
    - Campaign management
    - Ad Set management
    - Ad creation with media uploads
    - Audience fetching
    - Business portfolio operations
    """
    
    def __init__(self):
        self.app_id = settings.FACEBOOK_APP_ID
        self.app_secret = settings.FACEBOOK_APP_SECRET
        
    def _generate_app_secret_proof(self, access_token: str) -> str:
        """
        Generate appsecret_proof for secure API calls
        Required for server-side API calls to prove the request comes from a server with the app secret
        
        @see https://developers.facebook.com/docs/graph-api/securing-requests
        """
        if not self.app_secret:
            return ""
        return hmac.new(
            self.app_secret.encode('utf-8'),
            access_token.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
    
    def _build_auth_params(self, access_token: str) -> str:
        """Build authentication query parameters"""
        app_secret_proof = self._generate_app_secret_proof(access_token)
        params = f"access_token={access_token}"
        if app_secret_proof:
            params += f"&appsecret_proof={app_secret_proof}"
        return params
    
    async def _api_get(
        self, 
        endpoint: str, 
        access_token: str, 
        params: Optional[Dict[str, str]] = None
    ) -> Dict[str, Any]:
        """Make authenticated GET request to Meta API"""
        auth_params = self._build_auth_params(access_token)
        url = f"{META_API_BASE}{endpoint}?{auth_params}"
        
        if params:
            for key, value in params.items():
                url += f"&{key}={value}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            
            if not response.is_success:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get("error", {}).get("message", "Unknown error")
                logger.error(f"Meta API GET error: {error_msg}")
                return {"error": error_msg, "data": None}
            
            return {"data": response.json(), "error": None}
    
    async def _api_post(
        self, 
        endpoint: str, 
        access_token: str, 
        body: Dict[str, Any],
        use_form: bool = True
    ) -> Dict[str, Any]:
        """Make authenticated POST request to Meta API"""
        app_secret_proof = self._generate_app_secret_proof(access_token)
        url = f"{META_API_BASE}{endpoint}"
        
        # Add auth to body
        body["access_token"] = access_token
        if app_secret_proof:
            body["appsecret_proof"] = app_secret_proof
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            if use_form:
                # Convert all values to strings for form data
                form_data = {k: str(v) if not isinstance(v, str) else v for k, v in body.items()}
                response = await client.post(url, data=form_data)
            else:
                response = await client.post(url, json=body)
            
            if not response.is_success:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get("error", {}).get("message", "Unknown error")
                logger.error(f"Meta API POST error: {error_msg}")
                return {"error": error_msg, "data": None}
            
            return {"data": response.json(), "error": None}
    
    async def _api_delete(
        self, 
        endpoint: str, 
        access_token: str
    ) -> Dict[str, Any]:
        """Make authenticated DELETE request to Meta API"""
        auth_params = self._build_auth_params(access_token)
        url = f"{META_API_BASE}{endpoint}?{auth_params}"
        
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.delete(url)
            
            if not response.is_success:
                error_data = response.json() if response.content else {}
                error_msg = error_data.get("error", {}).get("message", "Unknown error")
                logger.error(f"Meta API DELETE error: {error_msg}")
                return {"error": error_msg, "data": None}
            
            return {"data": response.json(), "error": None}
    
    # ========================================================================
    # CAMPAIGN OPERATIONS
    # ========================================================================
    
    async def fetch_campaigns(
        self, 
        account_id: str, 
        access_token: str
    ) -> Dict[str, Any]:
        """
        Fetch all campaigns with ad sets and ads for an ad account
        """
        auth_params = self._build_auth_params(access_token)
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Fetch campaigns, ad sets, and ads in parallel
            campaigns_url = (
                f"{META_API_BASE}/act_{account_id}/campaigns?"
                f"fields=id,name,objective,status,effective_status,daily_budget,"
                f"lifetime_budget,buying_type,bid_strategy,special_ad_categories,"
                f"created_time,updated_time,insights{{impressions,reach,clicks,spend,cpc,cpm,ctr}}"
                f"&limit=100&{auth_params}"
            )
            
            adsets_url = (
                f"{META_API_BASE}/act_{account_id}/adsets?"
                f"fields=id,name,campaign_id,status,optimization_goal,billing_event,"
                f"daily_budget,lifetime_budget,targeting,created_time,updated_time,"
                f"insights{{impressions,reach,clicks,spend,cpc,cpm,ctr}}"
                f"&limit=100&{auth_params}"
            )
            
            ads_url = (
                f"{META_API_BASE}/act_{account_id}/ads?"
                f"fields=id,name,adset_id,campaign_id,status,effective_status,created_time,updated_time,"
                f"creative{{id,name,object_story_spec}},"
                f"insights{{impressions,reach,clicks,spend,cpc,cpm,ctr}}"
                f"&limit=100&{auth_params}"
            )
            
            campaigns_resp, adsets_resp, ads_resp = await asyncio.gather(
                client.get(campaigns_url),
                client.get(adsets_url),
                client.get(ads_url),
                return_exceptions=True
            )
            
            campaigns = []
            adsets = []
            ads = []
            
            if isinstance(campaigns_resp, httpx.Response) and campaigns_resp.is_success:
                data = campaigns_resp.json()
                campaigns = self._normalize_insights(data.get("data", []))
            
            if isinstance(adsets_resp, httpx.Response) and adsets_resp.is_success:
                data = adsets_resp.json()
                adsets = self._normalize_insights(data.get("data", []))
            
            if isinstance(ads_resp, httpx.Response) and ads_resp.is_success:
                data = ads_resp.json()
                ads = self._normalize_insights(data.get("data", []))
            
            return {
                "campaigns": campaigns,
                "adSets": adsets,
                "ads": ads
            }
    
    def _normalize_insights(self, items: List[Dict]) -> List[Dict]:
        """Normalize insights data - Meta returns insights as array, take first element"""
        for item in items:
            insights = item.get("insights")
            if insights:
                if isinstance(insights, dict) and "data" in insights:
                    item["insights"] = insights["data"][0] if insights["data"] else None
                elif isinstance(insights, list) and len(insights) > 0:
                    item["insights"] = insights[0]
        return items
    
    async def create_campaign(
        self,
        account_id: str,
        access_token: str,
        name: str,
        objective: str,
        status: str = "PAUSED",
        special_ad_categories: Optional[List[str]] = None,
        budget_type: Optional[str] = None,
        budget_amount: Optional[float] = None,
        bid_strategy: Optional[str] = None,
        is_cbo: bool = False
    ) -> Dict[str, Any]:
        """
        Create a new campaign
        
        Args:
            account_id: Ad account ID (without 'act_' prefix)
            access_token: User access token
            name: Campaign name
            objective: Campaign objective (will be mapped to OUTCOME-based)
            status: Initial status (ACTIVE or PAUSED)
            special_ad_categories: List of special ad categories
            budget_type: 'daily' or 'lifetime'
            budget_amount: Budget amount in account currency
            bid_strategy: Bid strategy
            is_cbo: Whether to use Campaign Budget Optimization
        """
        # Map objective to OUTCOME-based if needed
        mapped_objective = OBJECTIVE_MAPPING.get(objective.upper(), "OUTCOME_TRAFFIC")
        
        payload: Dict[str, Any] = {
            "name": name,
            "objective": mapped_objective,
            "status": status,
            "special_ad_categories": str(special_ad_categories or []),
        }
        
        # Add budget at campaign level only for CBO
        if is_cbo and budget_amount:
            budget_cents = int(budget_amount * 100)
            if budget_type == "lifetime":
                payload["lifetime_budget"] = budget_cents
            else:
                payload["daily_budget"] = budget_cents
            
            # Only set bid_strategy for cap-based strategies
            if bid_strategy and bid_strategy in ["LOWEST_COST_WITH_BID_CAP", "COST_CAP", "LOWEST_COST_WITH_MIN_ROAS"]:
                payload["bid_strategy"] = bid_strategy
        else:
            # Non-CBO: ad sets manage their own budgets
            payload["is_adset_budget_sharing_enabled"] = "false"
        
        result = await self._api_post(f"/act_{account_id}/campaigns", access_token, payload)
        
        if result.get("error"):
            return {"success": False, "error": result["error"]}
        
        return {"success": True, "campaign": result["data"]}
    
    async def update_campaign(
        self,
        campaign_id: str,
        access_token: str,
        **updates
    ) -> Dict[str, Any]:
        """Update a campaign"""
        if not updates:
            return {"success": False, "error": "No updates provided"}
        
        result = await self._api_post(f"/{campaign_id}", access_token, updates)
        
        if result.get("error"):
            return {"success": False, "error": result["error"]}
        
        return {"success": True}
    
    async def delete_campaign(
        self,
        campaign_id: str,
        access_token: str
    ) -> Dict[str, Any]:
        """Delete a campaign"""
        result = await self._api_delete(f"/{campaign_id}", access_token)
        
        if result.get("error"):
            return {"success": False, "error": result["error"]}
        
        return {"success": True}
    
    # ========================================================================
    # AD SET OPERATIONS
    # ========================================================================
    
    async def fetch_adsets(
        self,
        account_id: str,
        access_token: str
    ) -> Dict[str, Any]:
        """Fetch all ad sets for an ad account"""
        result = await self._api_get(
            f"/act_{account_id}/adsets",
            access_token,
            {
                "fields": "id,name,campaign_id,status,effective_status,optimization_goal,"
                          "billing_event,bid_strategy,bid_amount,daily_budget,lifetime_budget,"
                          "targeting,promoted_object,start_time,end_time,created_time,updated_time,"
                          "insights{impressions,reach,clicks,spend,cpc,cpm,ctr}",
                "limit": "100"
            }
        )
        
        if result.get("error"):
            return {"adSets": [], "error": result["error"]}
        
        adsets = self._normalize_insights(result["data"].get("data", []))
        return {"adSets": adsets}
    
    async def get_campaign_details(
        self,
        campaign_id: str,
        access_token: str
    ) -> Dict[str, Any]:
        """Get campaign details including objective and budget info"""
        result = await self._api_get(
            f"/{campaign_id}",
            access_token,
            {"fields": "id,name,objective,daily_budget,lifetime_budget,bid_strategy,smart_promotion_type"}
        )
        
        if result.get("error"):
            return {"campaign": None, "error": result["error"]}
        
        return {"campaign": result["data"]}
    
    async def create_adset(
        self,
        account_id: str,
        access_token: str,
        name: str,
        campaign_id: str,
        targeting: Dict[str, Any],
        page_id: Optional[str] = None,
        optimization_goal: Optional[str] = None,
        billing_event: str = "IMPRESSIONS",
        status: str = "PAUSED",
        budget_type: str = "daily",
        budget_amount: float = 10.0,
        bid_strategy: Optional[str] = None,
        bid_amount: Optional[float] = None,
        start_time: Optional[str] = None,
        end_time: Optional[str] = None,
        promoted_object: Optional[Dict[str, Any]] = None,
        destination_type: Optional[str] = None,
        # v24.0 NEW parameters
        is_adset_budget_sharing_enabled: Optional[bool] = None,
        placement_soft_opt_out: Optional[bool] = None
    ) -> Dict[str, Any]:
        """
        Create a new ad set - v24.0
        
        New v24.0 parameters:
        - is_adset_budget_sharing_enabled: Share up to 20% of budget with other ad sets
        - placement_soft_opt_out: Allow up to 5% spend on excluded placements (Sales/Leads only)
        """
        # Get campaign details to determine proper optimization goal
        campaign_result = await self.get_campaign_details(campaign_id, access_token)
        if campaign_result.get("error"):
            return {"success": False, "error": f"Invalid campaign: {campaign_result['error']}"}
        
        campaign = campaign_result["campaign"]
        objective = campaign.get("objective", "OUTCOME_TRAFFIC")
        has_campaign_budget = bool(campaign.get("daily_budget") or campaign.get("lifetime_budget"))
        
        # Determine optimization goal
        if not optimization_goal:
            valid_goals = OBJECTIVE_VALID_GOALS.get(objective, ["LINK_CLICKS"])
            optimization_goal = valid_goals[0]
        
        # Determine billing event
        billing_event = OPTIMIZATION_TO_BILLING.get(optimization_goal, "IMPRESSIONS")
        
        # Build payload
        payload: Dict[str, Any] = {
            "name": name,
            "campaign_id": campaign_id,
            "status": status,
            "optimization_goal": optimization_goal,
            "billing_event": billing_event,
        }
        
        # Targeting (required)
        if not targeting or not targeting.get("geo_locations"):
            targeting = {"geo_locations": {"countries": ["US"]}}
        payload["targeting"] = str(targeting).replace("'", '"')  # JSON format
        
        # Budget (only for non-CBO campaigns)
        if not has_campaign_budget:
            budget_cents = int(budget_amount * 100)
            if budget_type == "lifetime":
                payload["lifetime_budget"] = budget_cents
            else:
                payload["daily_budget"] = budget_cents
        
        # Bid strategy and amount
        if bid_strategy and bid_strategy in ["LOWEST_COST_WITH_BID_CAP", "COST_CAP", "LOWEST_COST_WITH_MIN_ROAS"]:
            if not bid_amount:
                return {"success": False, "error": f"Bid amount required for {bid_strategy} strategy"}
            if not has_campaign_budget:
                payload["bid_strategy"] = bid_strategy
            payload["bid_amount"] = int(bid_amount * 100)
        
        # Promoted object (for conversion goals)
        if promoted_object:
            payload["promoted_object"] = str(promoted_object).replace("'", '"')
        elif page_id and optimization_goal in ["LEAD_GENERATION", "OFFSITE_CONVERSIONS"]:
            payload["promoted_object"] = f'{{"page_id": "{page_id}"}}'
        
        # Destination type
        if destination_type:
            payload["destination_type"] = destination_type
        
        # Schedule
        if start_time:
            payload["start_time"] = start_time
        if end_time:
            payload["end_time"] = end_time
        
        # v24.0: Ad Set Budget Sharing
        if is_adset_budget_sharing_enabled is not None and not has_campaign_budget:
            payload["is_adset_budget_sharing_enabled"] = str(is_adset_budget_sharing_enabled).lower()
        
        # v24.0: Placement Soft Opt Out (Sales/Leads objectives only)
        if placement_soft_opt_out is not None and objective in ["OUTCOME_SALES", "OUTCOME_LEADS"]:
            payload["placement_soft_opt_out"] = str(placement_soft_opt_out).lower()
        
        result = await self._api_post(f"/act_{account_id}/adsets", access_token, payload)
        
        if result.get("error"):
            return {"success": False, "error": result["error"]}
        
        return {"success": True, "adSet": result["data"]}
    
    async def update_adset(
        self,
        adset_id: str,
        access_token: str,
        **updates
    ) -> Dict[str, Any]:
        """Update an ad set"""
        if not updates:
            return {"success": False, "error": "No updates provided"}
        
        result = await self._api_post(f"/{adset_id}", access_token, updates)
        
        if result.get("error"):
            return {"success": False, "error": result["error"]}
        
        return {"success": True}
    
    # ========================================================================
    # AD OPERATIONS
    # ========================================================================
    
    async def fetch_ads(
        self,
        account_id: str,
        access_token: str
    ) -> Dict[str, Any]:
        """Fetch all ads for an ad account"""
        result = await self._api_get(
            f"/act_{account_id}/ads",
            access_token,
            {
                "fields": "id,name,adset_id,campaign_id,status,effective_status,created_time,updated_time,"
                          "creative{id,name,object_story_spec},"
                          "insights{impressions,reach,clicks,spend,cpc,cpm,ctr,frequency,conversions}",
                "limit": "100"
            }
        )
        
        if result.get("error"):
            return {"ads": [], "error": result["error"]}
        
        ads = self._normalize_insights(result["data"].get("data", []))
        return {"ads": ads}
    
    async def upload_ad_image(
        self,
        account_id: str,
        access_token: str,
        image_url: str,
        name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Upload image to Meta Ad Library from URL
        Returns image hash for use in creatives
        """
        payload = {
            "url": image_url,
        }
        if name:
            payload["name"] = name
        
        result = await self._api_post(f"/act_{account_id}/adimages", access_token, payload, use_form=False)
        
        if result.get("error"):
            return {"success": False, "error": result["error"]}
        
        # Extract image hash from response
        images = result["data"].get("images", {})
        if images:
            first_key = next(iter(images))
            return {"success": True, "hash": images[first_key].get("hash")}
        
        return {"success": False, "error": "Failed to get image hash"}
    
    async def create_ad_creative(
        self,
        account_id: str,
        access_token: str,
        page_id: str,
        name: str,
        image_hash: Optional[str] = None,
        video_id: Optional[str] = None,
        title: Optional[str] = None,
        body: Optional[str] = None,
        link_url: Optional[str] = None,
        call_to_action_type: str = "LEARN_MORE"
    ) -> Dict[str, Any]:
        """
        Create an ad creative
        """
        # Build object_story_spec based on media type
        if video_id:
            object_story_spec = {
                "page_id": page_id,
                "video_data": {
                    "video_id": video_id,
                    "title": title or "",
                    "message": body or "",
                    "call_to_action": {
                        "type": call_to_action_type,
                        "value": {"link": link_url or ""}
                    }
                }
            }
        else:
            object_story_spec = {
                "page_id": page_id,
                "link_data": {
                    "link": link_url or "",
                    "message": body or "",
                    "name": title or "",
                    "call_to_action": {
                        "type": call_to_action_type,
                        "value": {"link": link_url or ""}
                    }
                }
            }
            if image_hash:
                object_story_spec["link_data"]["image_hash"] = image_hash
        
        payload = {
            "name": name,
            "object_story_spec": str(object_story_spec).replace("'", '"')
        }
        
        result = await self._api_post(f"/act_{account_id}/adcreatives", access_token, payload, use_form=False)
        
        if result.get("error"):
            return {"success": False, "error": result["error"]}
        
        return {"success": True, "creative_id": result["data"].get("id")}
    
    async def create_ad(
        self,
        account_id: str,
        access_token: str,
        name: str,
        adset_id: str,
        creative_id: str,
        status: str = "PAUSED"
    ) -> Dict[str, Any]:
        """
        Create a new ad
        """
        payload = {
            "name": name,
            "adset_id": adset_id,
            "status": status,
            "creative": f'{{"creative_id": "{creative_id}"}}'
        }
        
        result = await self._api_post(f"/act_{account_id}/ads", access_token, payload)
        
        if result.get("error"):
            return {"success": False, "error": result["error"]}
        
        return {"success": True, "ad": result["data"]}
    
    async def update_ad(
        self,
        ad_id: str,
        access_token: str,
        **updates
    ) -> Dict[str, Any]:
        """Update an ad"""
        if not updates:
            return {"success": False, "error": "No updates provided"}
        
        result = await self._api_post(f"/{ad_id}", access_token, updates)
        
        if result.get("error"):
            return {"success": False, "error": result["error"]}
        
        return {"success": True}
    
    # ========================================================================
    # AUDIENCE OPERATIONS
    # ========================================================================
    
    async def fetch_audiences(
        self,
        account_id: str,
        access_token: str
    ) -> Dict[str, Any]:
        """Fetch custom audiences for an ad account - v24.0"""
        result = await self._api_get(
            f"/act_{account_id}/customaudiences",
            access_token,
            {
                "fields": "id,name,description,subtype,approximate_count,approximate_count_lower_bound,"
                         "approximate_count_upper_bound,retention_days,time_created,time_updated,"
                         "lookalike_spec,delivery_status,operation_status,is_value_based"
            }
        )
        
        if result.get("error"):
            return {"audiences": [], "error": result["error"]}
        
        return {"audiences": result["data"].get("data", [])}
    
    async def create_custom_audience(
        self,
        account_id: str,
        access_token: str,
        name: str,
        subtype: str = "CUSTOM",
        description: Optional[str] = None,
        customer_file_source: str = "USER_PROVIDED_ONLY",
        retention_days: int = 30
    ) -> Dict[str, Any]:
        """Create a custom audience"""
        payload = {
            "name": name,
            "subtype": subtype,
            "description": description or "",
            "customer_file_source": customer_file_source,
            "retention_days": str(retention_days),
        }
        
        result = await self._api_post(
            f"/act_{account_id}/customaudiences",
            access_token,
            payload,
            use_form=False
        )
        
        if result.get("error"):
            return {"success": False, "error": result["error"]}
        
        return {"success": True, "audience": result["data"]}
    
    async def create_lookalike_audience(
        self,
        account_id: str,
        access_token: str,
        name: str,
        origin_audience_id: str,
        country: str,
        ratio: float,
        lookalike_type: str = "similarity"
    ) -> Dict[str, Any]:
        """
        Create a lookalike audience - v24.0
        
        IMPORTANT: From January 6, 2026, lookalike_spec is MANDATORY
        
        Args:
            account_id: Ad account ID
            access_token: User access token
            name: Audience name
            origin_audience_id: Source custom audience ID
            country: ISO 2-letter country code
            ratio: Similarity ratio (0.01-0.20)
            lookalike_type: 'similarity', 'reach', or 'custom_ratio'
        """
        import json
        
        lookalike_spec = {
            "country": country,
            "ratio": ratio,
            "type": lookalike_type
        }
        
        payload = {
            "name": name,
            "subtype": "LOOKALIKE",
            "origin_audience_id": origin_audience_id,
            "lookalike_spec": json.dumps(lookalike_spec),
        }
        
        result = await self._api_post(
            f"/act_{account_id}/customaudiences",
            access_token,
            payload,
            use_form=False
        )
        
        if result.get("error"):
            return {"success": False, "error": result["error"]}
        
        return {"success": True, "audience": result["data"]}
    
    # ========================================================================
    # INSIGHTS OPERATIONS - v24.0
    # ========================================================================
    
    async def fetch_insights(
        self,
        account_id: str,
        access_token: str,
        level: str = "account",
        date_preset: str = "last_7d",
        fields: Optional[List[str]] = None,
        breakdowns: Optional[List[str]] = None,
        filtering: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Fetch insights/analytics - v24.0
        
        v24.0 includes new instagram_profile_visits metric
        
        Note: From January 12, 2026:
        - 7-day and 28-day view-through attribution data unavailable
        - Breakdown data limited to 13 months
        """
        default_fields = [
            "impressions", "reach", "clicks", "spend", "cpc", "cpm", "ctr",
            "frequency", "actions", "cost_per_action_type",
            "conversions", "cost_per_conversion", "conversion_rate_ranking",
            "quality_ranking", "engagement_rate_ranking",
            # v24.0 new metric
            "instagram_profile_visits"
        ]
        
        params = {
            "date_preset": date_preset,
            "fields": ",".join(fields or default_fields),
            "level": level,
        }
        
        if breakdowns:
            params["breakdowns"] = ",".join(breakdowns)
        
        if filtering:
            import json
            params["filtering"] = json.dumps(filtering)
        
        result = await self._api_get(
            f"/act_{account_id}/insights",
            access_token,
            params
        )
        
        if result.get("error"):
            return {"insights": [], "error": result["error"]}
        
        return {"insights": result["data"].get("data", [])}
    
    async def fetch_campaign_insights(
        self,
        campaign_id: str,
        access_token: str,
        date_preset: str = "last_7d"
    ) -> Dict[str, Any]:
        """Fetch insights for a specific campaign"""
        result = await self._api_get(
            f"/{campaign_id}/insights",
            access_token,
            {
                "date_preset": date_preset,
                "fields": "impressions,reach,clicks,spend,cpc,cpm,ctr,frequency,"
                         "actions,cost_per_action_type,conversions,instagram_profile_visits"
            }
        )
        
        if result.get("error"):
            return {"insights": None, "error": result["error"]}
        
        data = result["data"].get("data", [])
        return {"insights": data[0] if data else None}
    
    # ========================================================================
    # AD ACCOUNT & BUSINESS OPERATIONS
    # ========================================================================
    
    async def get_ad_account_info(
        self,
        account_id: str,
        access_token: str
    ) -> Dict[str, Any]:
        """Get ad account details - v24.0"""
        result = await self._api_get(
            f"/act_{account_id}",
            access_token,
            {
                "fields": "id,account_id,name,currency,timezone_name,timezone_offset_hours_utc,"
                         "amount_spent,balance,spend_cap,business,funding_source,capabilities"
            }
        )
        
        if result.get("error"):
            return {"adAccount": None, "error": result["error"]}
        
        return {"adAccount": result["data"]}
    
    async def fetch_user_businesses(
        self,
        access_token: str
    ) -> Dict[str, Any]:
        """Fetch user's business portfolios"""
        result = await self._api_get(
            "/me/businesses",
            access_token,
            {"fields": "id,name"}
        )
        
        if result.get("error"):
            return {"businesses": [], "error": result["error"]}
        
        return {"businesses": result["data"].get("data", [])}
    
    async def fetch_business_ad_accounts(
        self,
        business_id: str,
        access_token: str
    ) -> Dict[str, Any]:
        """Fetch ad accounts owned by a business"""
        result = await self._api_get(
            f"/{business_id}/owned_ad_accounts",
            access_token,
            {"fields": "id,account_id,name,currency,timezone_name,capabilities"}
        )
        
        if result.get("error"):
            return {"adAccounts": [], "error": result["error"]}
        
        accounts = result["data"].get("data", [])
        return {
            "adAccounts": [
                {
                    "id": acc.get("id"),
                    "account_id": acc.get("account_id") or acc.get("id", "").replace("act_", ""),
                    "name": acc.get("name"),
                    "currency": acc.get("currency"),
                    "timezone": acc.get("timezone_name"),
                    "capabilities": acc.get("capabilities", [])
                }
                for acc in accounts
            ]
        }
    
    async def fetch_pages(
        self,
        access_token: str
    ) -> Dict[str, Any]:
        """Fetch user's Facebook Pages"""
        result = await self._api_get(
            "/me/accounts",
            access_token,
            {"fields": "id,name,access_token,category,picture"}
        )
        
        if result.get("error"):
            return {"pages": [], "error": result["error"]}
        
        return {"pages": result["data"].get("data", [])}


# Import asyncio for parallel requests
import asyncio

# Singleton instance
_meta_ads_service: Optional[MetaAdsService] = None


def get_meta_ads_service() -> MetaAdsService:
    """Get or create MetaAdsService singleton"""
    global _meta_ads_service
    if _meta_ads_service is None:
        _meta_ads_service = MetaAdsService()
    return _meta_ads_service

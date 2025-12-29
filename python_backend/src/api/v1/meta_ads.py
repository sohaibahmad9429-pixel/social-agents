"""
Meta Ads API Router
Production-ready FastAPI endpoints for Meta Ads management

Provides endpoints for:
- Connection status
- OAuth flow
- Campaign CRUD
- Ad Set CRUD
- Ad CRUD with creative uploads
- Draft management
- Audience listing
- Business portfolio switching
"""
import logging
import uuid
from typing import Optional
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Request, HTTPException, Query, Path
from fastapi.responses import JSONResponse, RedirectResponse

from ...services.supabase_service import (
    get_supabase_admin_client,
    ensure_user_workspace,
    log_activity
)
from ...services.meta_ads_service import get_meta_ads_service
from ...services.meta_credentials_service import MetaCredentialsService
from ...schemas.meta_ads import (
    CreateCampaignRequest,
    UpdateCampaignRequest,
    CreateAdSetRequest,
    UpdateAdSetRequest,
    CreateAdRequest,
    UpdateAdRequest,
    CreateAdDraftRequest,
    SwitchBusinessRequest,
    MetaAdsStatusResponse,
    CampaignListResponse,
    AudienceListResponse,
    OAuthUrlResponse,
    SuccessResponse,
    ErrorResponse,
)
from ...config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/meta-ads", tags=["Meta Ads"])

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_user_context(request: Request) -> tuple[str, str]:
    """Extract user_id and workspace_id from authenticated request"""
    user = getattr(request.state, 'user', None)
    if not user:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    user_id = user.get('id')
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid user")
    
    # Ensure workspace exists
    workspace_id = await ensure_user_workspace(user_id, user.get('email'))
    
    return user_id, workspace_id


async def get_verified_credentials(workspace_id: str, user_id: str):
    """Get and verify Meta Ads credentials"""
    credentials = await MetaCredentialsService.get_ads_credentials(workspace_id, user_id)
    
    if not credentials or not credentials.get('access_token'):
        raise HTTPException(
            status_code=401, 
            detail="Meta Ads not connected. Please connect your Meta account."
        )
    
    if not credentials.get('account_id'):
        raise HTTPException(
            status_code=400,
            detail="No Ad Account configured. Please ensure your Facebook account has access to an Ad Account."
        )
    
    return credentials


# ============================================================================
# STATUS ENDPOINTS
# ============================================================================

@router.get("/status")
async def get_status(request: Request):
    """
    GET /api/v1/meta-ads/status
    
    Returns connection status for Meta Ads including:
    - Connection status
    - Ad account info
    - Facebook page info
    - Platform connection details
    - What's missing for ads (if any)
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        
        # Get connection status
        connection_status = await MetaCredentialsService.get_connection_status(workspace_id)
        
        # Get ads capability
        capability = await MetaCredentialsService.check_ads_capability(workspace_id, user_id)
        
        # Get credentials for additional info
        credentials = await MetaCredentialsService.get_ads_credentials(workspace_id, user_id)
        
        if not credentials or not credentials.get('access_token'):
            return JSONResponse(content={
                "isConnected": False,
                "canRunAds": False,
                "message": "No Meta platform connected",
                "platforms": connection_status,
                "suggestion": "Connect your Facebook account to enable Meta Ads"
            })
        
        # Check token expiration
        if credentials.get("is_expired"):
            return JSONResponse(content={
                "isConnected": False,
                "canRunAds": False,
                "tokenExpired": True,
                "message": "Your Meta connection has expired. Please reconnect.",
                "platforms": connection_status
            })
        
        # Get ad account info if available
        ad_account = None
        if credentials.get("account_id"):
            service = get_meta_ads_service()
            ad_account_result = await service.get_ad_account_info(
                credentials["account_id"],
                credentials["access_token"]
            )
            ad_account = ad_account_result.get("adAccount") or {
                "id": f"act_{credentials['account_id']}",
                "account_id": credentials["account_id"],
                "name": credentials.get("account_name", "Ad Account"),
                "currency": "USD",
                "timezone_name": "America/Los_Angeles"
            }
        
        return JSONResponse(content={
            "isConnected": True,
            "canRunAds": capability.get("has_ads_access", False),
            "tokenExpiresSoon": credentials.get("expires_soon", False),
            "expiresAt": credentials.get("expires_at"),
            "adAccount": ad_account,
            "page": {
                "id": credentials.get("page_id"),
                "name": credentials.get("page_name")
            } if credentials.get("page_id") else None,
            "platforms": connection_status,
            "missingForAds": capability.get("missing_permissions"),
            "message": "Ready to run Meta Ads" if capability.get("has_ads_access") else (
                capability.get("missing_permissions", ["Additional setup required"])[0]
            )
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting Meta Ads status: {e}")
        return JSONResponse(
            status_code=500,
            content={
                "isConnected": False,
                "canRunAds": False,
                "error": "Failed to check Meta Ads status",
                "message": str(e)
            }
        )


# ============================================================================
# AUTH ENDPOINTS
# ============================================================================

@router.get("/auth/url")
async def get_auth_url(request: Request):
    """
    GET /api/v1/meta-ads/auth/url
    
    Generate OAuth authorization URL for Meta Ads
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        
        app_id = settings.FACEBOOK_APP_ID
        if not app_id:
            raise HTTPException(
                status_code=500,
                detail="Meta App ID not configured"
            )
        
        # Generate CSRF state token
        state = str(uuid.uuid4())
        
        # Store state for validation
        client = get_supabase_admin_client()
        client.table("oauth_states").insert({
            "state": state,
            "workspace_id": workspace_id,
            "platform": "meta_ads",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
        }).execute()
        
        # Build redirect URI
        redirect_uri = settings.META_ADS_REDIRECT_URI or f"{settings.NEXT_PUBLIC_APP_URL}/api/meta-ads/auth/callback"
        
        # Required scopes for Meta Marketing API
        scopes = ",".join([
            "ads_management",
            "ads_read",
            "business_management",
            "pages_read_engagement",
            "pages_show_list",
            "pages_manage_ads"
        ])
        
        auth_url = (
            f"https://www.facebook.com/v24.0/dialog/oauth?"
            f"client_id={app_id}"
            f"&redirect_uri={redirect_uri}"
            f"&scope={scopes}"
            f"&response_type=code"
            f"&state={state}"
        )
        
        return JSONResponse(content={"url": auth_url})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating auth URL: {e}")
        raise HTTPException(status_code=500, detail="Failed to generate authorization URL")


@router.get("/auth/callback")
async def auth_callback(
    request: Request,
    code: Optional[str] = Query(None),
    state: Optional[str] = Query(None),
    error: Optional[str] = Query(None)
):
    """
    GET /api/v1/meta-ads/auth/callback
    
    OAuth callback handler for Meta Ads
    Exchanges code for access token and stores credentials
    """
    # This endpoint is typically handled by Next.js frontend
    # Include basic implementation for completeness
    
    if error:
        return RedirectResponse(
            url=f"{settings.NEXT_PUBLIC_APP_URL}/dashboard/meta-ads?error={error}"
        )
    
    if not code or not state:
        return RedirectResponse(
            url=f"{settings.NEXT_PUBLIC_APP_URL}/dashboard/meta-ads?error=missing_params"
        )
    
    # In production, validate state and exchange code for token
    # For now, redirect to frontend which handles the full flow
    return RedirectResponse(
        url=f"{settings.NEXT_PUBLIC_APP_URL}/dashboard/meta-ads?code={code}&state={state}"
    )


# ============================================================================
# BUSINESS PORTFOLIO ENDPOINTS
# ============================================================================

@router.get("/switch-business")
async def list_businesses(request: Request):
    """
    GET /api/v1/meta-ads/switch-business
    
    List available business portfolios with their ad accounts
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        
        businesses = await MetaCredentialsService.get_available_businesses(workspace_id, user_id)
        
        return JSONResponse(content={
            "businesses": businesses
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing businesses: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/switch-business")
async def switch_business(request: Request, body: SwitchBusinessRequest):
    """
    POST /api/v1/meta-ads/switch-business
    
    Switch to a different business portfolio and ad account
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        
        result = await MetaCredentialsService.switch_business(
            workspace_id,
            body.businessId,
            body.adAccountId,
            user_id
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to switch business"))
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error switching business: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# CAMPAIGN ENDPOINTS
# ============================================================================

@router.get("/campaigns")
async def list_campaigns(request: Request):
    """
    GET /api/v1/meta-ads/campaigns
    
    List all campaigns with ad sets and ads
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        service = get_meta_ads_service()
        result = await service.fetch_campaigns(
            credentials["account_id"],
            credentials["access_token"]
        )
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching campaigns: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/campaigns")
async def create_campaign(request: Request, body: CreateCampaignRequest):
    """
    POST /api/v1/meta-ads/campaigns
    
    Create a new campaign
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        service = get_meta_ads_service()
        result = await service.create_campaign(
            account_id=credentials["account_id"],
            access_token=credentials["access_token"],
            name=body.name,
            objective=body.objective.value,
            status=body.status.value if body.status else "PAUSED",
            special_ad_categories=[c.value for c in (body.special_ad_categories or [])],
            budget_type=body.budget_type,
            budget_amount=body.budget_amount,
            bid_strategy=body.bid_strategy.value if body.bid_strategy else None,
            is_cbo=body.is_campaign_budget_optimization or False
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))
        
        # Store in database for audit
        try:
            client = get_supabase_admin_client()
            campaign_data = result.get("campaign", {})
            client.table("meta_campaigns").insert({
                "workspace_id": workspace_id,
                "user_id": user_id,
                "meta_campaign_id": campaign_data.get("id"),
                "name": body.name,
                "objective": body.objective.value,
                "status": body.status.value if body.status else "PAUSED",
                "bid_strategy": body.bid_strategy.value if body.bid_strategy else None,
                "daily_budget": int(body.budget_amount * 100) if body.budget_type == "daily" and body.budget_amount else None,
                "lifetime_budget": int(body.budget_amount * 100) if body.budget_type == "lifetime" and body.budget_amount else None,
                "special_ad_categories": [c.value for c in (body.special_ad_categories or [])],
                "is_campaign_budget_optimization": body.is_campaign_budget_optimization or False,
                "last_synced_at": datetime.now(timezone.utc).isoformat()
            }).execute()
        except Exception as db_error:
            logger.warning(f"Failed to store campaign in DB: {db_error}")
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/campaigns/{campaign_id}")
async def update_campaign(
    request: Request,
    campaign_id: str = Path(...),
    body: UpdateCampaignRequest = None
):
    """
    PATCH /api/v1/meta-ads/campaigns/{campaign_id}
    
    Update a campaign
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        # Build updates dict
        updates = {}
        if body:
            if body.name:
                updates["name"] = body.name
            if body.status:
                updates["status"] = body.status.value
            if body.budget_amount:
                updates["daily_budget"] = int(body.budget_amount * 100)
        
        service = get_meta_ads_service()
        result = await service.update_campaign(
            campaign_id,
            credentials["access_token"],
            **updates
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))
        
        return JSONResponse(content={"success": True})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(
    request: Request,
    campaign_id: str = Path(...)
):
    """
    DELETE /api/v1/meta-ads/campaigns/{campaign_id}
    
    Delete a campaign
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        service = get_meta_ads_service()
        result = await service.delete_campaign(campaign_id, credentials["access_token"])
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))
        
        return JSONResponse(content={"success": True})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting campaign: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AD SET ENDPOINTS
# ============================================================================

@router.get("/adsets")
async def list_adsets(request: Request):
    """
    GET /api/v1/meta-ads/adsets
    
    List all ad sets
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        service = get_meta_ads_service()
        result = await service.fetch_adsets(
            credentials["account_id"],
            credentials["access_token"]
        )
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching ad sets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/adsets")
async def create_adset(request: Request, body: CreateAdSetRequest):
    """
    POST /api/v1/meta-ads/adsets
    
    Create a new ad set
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        # Build targeting dict
        targeting = {}
        if body.targeting:
            if body.targeting.geo_locations:
                targeting["geo_locations"] = body.targeting.geo_locations.model_dump(exclude_none=True)
            if body.targeting.age_min:
                targeting["age_min"] = body.targeting.age_min
            if body.targeting.age_max:
                targeting["age_max"] = body.targeting.age_max
            if body.targeting.genders:
                targeting["genders"] = body.targeting.genders
            if body.targeting.interests:
                targeting["interests"] = [i.model_dump() for i in body.targeting.interests]
        
        service = get_meta_ads_service()
        result = await service.create_adset(
            account_id=credentials["account_id"],
            access_token=credentials["access_token"],
            name=body.name,
            campaign_id=body.campaign_id,
            targeting=targeting or {"geo_locations": {"countries": ["US"]}},
            page_id=credentials.get("page_id"),
            optimization_goal=body.optimization_goal,
            billing_event=body.billing_event.value if body.billing_event else "IMPRESSIONS",
            status=body.status.value if body.status else "PAUSED",
            budget_type=body.budget_type or "daily",
            budget_amount=body.budget_amount or 10.0,
            bid_strategy=body.bid_strategy.value if body.bid_strategy else None,
            bid_amount=body.bid_amount,
            start_time=body.start_time,
            end_time=body.end_time,
            promoted_object=body.promoted_object.model_dump() if body.promoted_object else None,
            destination_type=body.destination_type.value if body.destination_type else None
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))
        
        # Store in database for audit
        try:
            client = get_supabase_admin_client()
            adset_data = result.get("adset", {})
            client.table("meta_adsets").insert({
                "workspace_id": workspace_id,
                "user_id": user_id,
                "meta_adset_id": adset_data.get("id"),
                "meta_campaign_id": body.campaign_id,
                "name": body.name,
                "status": body.status.value if body.status else "PAUSED",
                "optimization_goal": body.optimization_goal or "LINK_CLICKS",
                "billing_event": body.billing_event.value if body.billing_event else "IMPRESSIONS",
                "bid_strategy": body.bid_strategy.value if body.bid_strategy else None,
                "bid_amount": int(body.bid_amount * 100) if body.bid_amount else None,
                "daily_budget": int(body.budget_amount * 100) if body.budget_type == "daily" and body.budget_amount else None,
                "lifetime_budget": int(body.budget_amount * 100) if body.budget_type == "lifetime" and body.budget_amount else None,
                "destination_type": body.destination_type.value if body.destination_type else None,
                "targeting": targeting,
                "promoted_object": body.promoted_object.model_dump() if body.promoted_object else None,
                "start_time": body.start_time,
                "end_time": body.end_time,
                "last_synced_at": datetime.now(timezone.utc).isoformat()
            }).execute()
        except Exception as db_error:
            logger.warning(f"Failed to store ad set in DB: {db_error}")
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating ad set: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/adsets/{adset_id}")
async def update_adset(
    request: Request,
    adset_id: str = Path(...),
    body: UpdateAdSetRequest = None
):
    """
    PATCH /api/v1/meta-ads/adsets/{adset_id}
    
    Update an ad set
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        updates = {}
        if body:
            if body.name:
                updates["name"] = body.name
            if body.status:
                updates["status"] = body.status.value
            if body.budget_amount:
                updates["daily_budget"] = int(body.budget_amount * 100)
        
        service = get_meta_ads_service()
        result = await service.update_adset(
            adset_id,
            credentials["access_token"],
            **updates
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))
        
        return JSONResponse(content={"success": True})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating ad set: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AD ENDPOINTS
# ============================================================================

@router.get("/ads")
async def list_ads(request: Request):
    """
    GET /api/v1/meta-ads/ads
    
    List all ads
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        service = get_meta_ads_service()
        result = await service.fetch_ads(
            credentials["account_id"],
            credentials["access_token"]
        )
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching ads: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ads")
async def create_ad(request: Request, body: CreateAdRequest):
    """
    POST /api/v1/meta-ads/ads
    
    Create a new ad with creative
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        service = get_meta_ads_service()
        page_id = body.page_id or credentials.get("page_id")
        
        if not page_id:
            raise HTTPException(
                status_code=400,
                detail="page_id is required. Please connect a Facebook Page."
            )
        
        # Step 1: Upload image if URL provided
        image_hash = None
        if body.creative.image_url and not body.creative.image_hash:
            upload_result = await service.upload_ad_image(
                credentials["account_id"],
                credentials["access_token"],
                body.creative.image_url,
                body.creative.title
            )
            if upload_result.get("success"):
                image_hash = upload_result["hash"]
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to upload image: {upload_result.get('error')}"
                )
        else:
            image_hash = body.creative.image_hash
        
        # Step 2: Create ad creative
        creative_result = await service.create_ad_creative(
            account_id=credentials["account_id"],
            access_token=credentials["access_token"],
            page_id=page_id,
            name=f"{body.name} - Creative",
            image_hash=image_hash,
            video_id=body.creative.video_id,
            title=body.creative.title,
            body=body.creative.body,
            link_url=body.creative.link_url,
            call_to_action_type=body.creative.call_to_action_type.value if body.creative.call_to_action_type else "LEARN_MORE"
        )
        
        if not creative_result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=f"Failed to create creative: {creative_result.get('error')}"
            )
        
        # Step 3: Create ad
        ad_result = await service.create_ad(
            account_id=credentials["account_id"],
            access_token=credentials["access_token"],
            name=body.name,
            adset_id=body.adset_id,
            creative_id=creative_result["creative_id"],
            status=body.status.value if body.status else "PAUSED"
        )
        
        if not ad_result.get("success"):
            raise HTTPException(
                status_code=400,
                detail=f"Failed to create ad: {ad_result.get('error')}"
            )
        
        # Store in database
        try:
            client = get_supabase_admin_client()
            ad_data = ad_result.get("ad", {})
            
            # Try to get campaign_id from the creative result or ad data
            campaign_id = ad_data.get("campaign_id") or ad_data.get("campaign", {}).get("id")
            
            client.table("meta_ads").insert({
                "workspace_id": workspace_id,
                "user_id": user_id,
                "meta_ad_id": ad_data.get("id"),
                "meta_creative_id": creative_result["creative_id"],
                "meta_adset_id": body.adset_id,
                "meta_campaign_id": campaign_id,
                "name": body.name,
                "status": body.status.value if body.status else "PAUSED",
                "creative": body.creative.model_dump(),
                "last_synced_at": datetime.now(timezone.utc).isoformat()
            }).execute()
        except Exception as db_error:
            logger.warning(f"Failed to store ad in DB: {db_error}")
        
        return JSONResponse(content={
            "success": True,
            "ad": ad_result.get("ad")
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/ads/{ad_id}")
async def update_ad(
    request: Request,
    ad_id: str = Path(...),
    body: UpdateAdRequest = None
):
    """
    PATCH /api/v1/meta-ads/ads/{ad_id}
    
    Update an ad (typically status change)
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        updates = {}
        if body:
            if body.status:
                updates["status"] = body.status.value
            if body.name:
                updates["name"] = body.name
        
        service = get_meta_ads_service()
        result = await service.update_ad(
            ad_id,
            credentials["access_token"],
            **updates
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))
        
        return JSONResponse(content={"success": True})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating ad: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# DRAFT ENDPOINTS
# ============================================================================

@router.get("/ads/draft")
async def list_drafts(
    request: Request,
    workspaceId: Optional[str] = Query(None)
):
    """
    GET /api/v1/meta-ads/ads/draft
    
    List ad drafts
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        workspace_id = workspaceId or workspace_id
        
        client = get_supabase_admin_client()
        result = client.table("meta_ad_drafts").select("*").eq(
            "workspace_id", workspace_id
        ).eq("status", "draft").order("created_at", desc=True).execute()
        
        return JSONResponse(content={
            "drafts": result.data or []
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing drafts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ads/draft")
async def create_draft(request: Request, body: CreateAdDraftRequest):
    """
    POST /api/v1/meta-ads/ads/draft
    
    Create or update an ad draft
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        
        client = get_supabase_admin_client()
        
        draft_data = {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "platform": "facebook",  # Database requires platform field
            "ad_type": body.ad_type.value,
            "objective": body.objective,
            "optimization_goal": body.optimization_goal,
            "billing_event": body.billing_event or "IMPRESSIONS",
            "creative": body.creative,
            "targeting": body.targeting,
            "budget": body.budget,
            "schedule": body.schedule,
            "campaign_name": body.campaign_name,
            "adset_name": body.adset_name,
            "ad_name": body.ad_name,
            "destination_type": body.destination_type,
            "bid_strategy": body.bid_strategy,
            "status": "draft",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        result = client.table("meta_ad_drafts").insert(draft_data).execute()
        
        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to create draft")
        
        return JSONResponse(content={
            "success": True,
            "draft": result.data[0]
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating draft: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/ads/draft/{draft_id}")
async def delete_draft(
    request: Request,
    draft_id: str = Path(...)
):
    """
    DELETE /api/v1/meta-ads/ads/draft/{draft_id}
    
    Delete an ad draft
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        
        client = get_supabase_admin_client()
        client.table("meta_ad_drafts").delete().eq(
            "id", draft_id
        ).eq("workspace_id", workspace_id).execute()
        
        return JSONResponse(content={"success": True})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting draft: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# AUDIENCE ENDPOINTS
# ============================================================================

@router.get("/audiences")
async def list_audiences(request: Request):
    """
    GET /api/v1/meta-ads/audiences
    
    List custom audiences
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        service = get_meta_ads_service()
        result = await service.fetch_audiences(
            credentials["account_id"],
            credentials["access_token"]
        )
        
        return JSONResponse(content=result)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching audiences: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/audiences/custom")
async def create_custom_audience(request: Request):
    """
    POST /api/v1/meta-ads/audiences/custom
    
    Create a custom audience
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        body = await request.json()
        
        service = get_meta_ads_service()
        result = await service.create_custom_audience(
            credentials["account_id"],
            credentials["access_token"],
            name=body.get("name"),
            subtype=body.get("subtype", "CUSTOM"),
            description=body.get("description"),
            customer_file_source="USER_PROVIDED_ONLY",
            retention_days=body.get("retention_days", 30)
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))
        
        return JSONResponse(content={"success": True, "audience": result.get("audience")})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating custom audience: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/audiences/lookalike")
async def create_lookalike_audience(request: Request):
    """
    POST /api/v1/meta-ads/audiences/lookalike
    
    Create a lookalike audience - v24.0
    
    IMPORTANT: From January 6, 2026, lookalike_spec format is mandatory
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        body = await request.json()
        
        service = get_meta_ads_service()
        result = await service.create_lookalike_audience(
            account_id=credentials["account_id"],
            access_token=credentials["access_token"],
            name=body.get("name"),
            origin_audience_id=body.get("source_audience_id"),
            country=body.get("country", "US"),
            ratio=body.get("ratio", 0.01),
            lookalike_type=body.get("type", "similarity")
        )
        
        if not result.get("success"):
            raise HTTPException(status_code=400, detail=result.get("error"))
        
        return JSONResponse(content={"success": True, "audience": result.get("audience")})
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating lookalike audience: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# ANALYTICS/INSIGHTS ENDPOINTS - v24.0
# ============================================================================

@router.get("/analytics")
async def get_analytics(
    request: Request,
    date_preset: str = Query("last_7d"),
    level: str = Query("account")
):
    """
    GET /api/v1/meta-ads/analytics
    
    Get analytics insights - v24.0
    
    Includes instagram_profile_visits metric (new in v24.0)
    
    Note: From January 12, 2026:
    - 7-day and 28-day view-through attribution data unavailable
    - Breakdown data limited to 13 months
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        service = get_meta_ads_service()
        result = await service.fetch_insights(
            credentials["account_id"],
            credentials["access_token"],
            level=level,
            date_preset=date_preset
        )
        
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        
        return JSONResponse(content={
            "insights": result.get("insights", [])
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching analytics: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/insights/{campaign_id}")
async def get_campaign_insights(
    request: Request,
    campaign_id: str = Path(...),
    date_preset: str = Query("last_7d")
):
    """
    GET /api/v1/meta-ads/insights/{campaign_id}
    
    Get insights for a specific campaign - v24.0
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        service = get_meta_ads_service()
        result = await service.fetch_campaign_insights(
            campaign_id,
            credentials["access_token"],
            date_preset=date_preset
        )
        
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        
        return JSONResponse(content={
            "insights": result.get("insights")
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching campaign insights: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/pages")
async def list_pages(request: Request):
    """
    GET /api/v1/meta-ads/pages
    
    List user's Facebook Pages
    """
    try:
        user_id, workspace_id = await get_user_context(request)
        credentials = await get_verified_credentials(workspace_id, user_id)
        
        service = get_meta_ads_service()
        result = await service.fetch_pages(credentials["access_token"])
        
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        
        return JSONResponse(content={
            "pages": result.get("pages", [])
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching pages: {e}")
        raise HTTPException(status_code=500, detail=str(e))


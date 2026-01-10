"""
SDK A/B Testing Service
Meta Business SDK - Ad Studies (Split Testing)

Uses:
- facebook_business.adobjects.adstudy
- facebook_business.adobjects.business
- Create, manage, and analyze A/B tests
"""
import asyncio
import logging
import json
import hmac
import hashlib
import time
from datetime import datetime
from typing import Optional, Dict, Any, List

from facebook_business.adobjects.business import Business
from facebook_business.exceptions import FacebookRequestError

from ...config import settings

logger = logging.getLogger(__name__)

# API Version
META_API_VERSION = "v24.0"

# Test types
AB_TEST_TYPES = [
    "SPLIT_TEST",           # Standard A/B test
    "MULTI_CELL_TEST",      # Multiple cells
    "HOLDOUT",              # Holdout test
    "CONTINUOUS_LIFT_CONFIG"  # Lift measurement
]


class ABTestsService:
    """Service for A/B testing (Ad Studies) using Meta SDK."""
    
    def __init__(self, access_token: str, app_secret: Optional[str] = None):
        """
        Initialize A/B Tests Service.
        
        Args:
            access_token: User access token with ads_management permission
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
    
    def _parse_timestamp(self, ts) -> int:
        """Parse timestamp (Meta returns ISO strings like '2026-01-05T11:22:00+0000')"""
        if not ts:
            return 0
        if isinstance(ts, int):
            return ts
        if isinstance(ts, str):
            if ts.isdigit():
                return int(ts)
            try:
                dt = datetime.fromisoformat(ts.replace('+0000', '+00:00'))
                return int(dt.timestamp())
            except:
                return 0
        return 0
    
    def _calculate_status(self, start_time, end_time, canceled_time=None) -> str:
        """Calculate test status based on times"""
        current_time = int(time.time())
        
        if canceled_time:
            return 'CANCELED'
        
        if start_time and end_time:
            start_ts = self._parse_timestamp(start_time)
            end_ts = self._parse_timestamp(end_time)
            if current_time < start_ts:
                return 'SCHEDULED'
            elif current_time >= start_ts and current_time <= end_ts:
                return 'ACTIVE'
            elif current_time > end_ts:
                return 'COMPLETED'
        
        return 'DRAFT'
    
    def _create_ab_test_sync(
        self,
        account_id: str,
        name: str,
        test_type: str = "SPLIT_TEST",
        cells: Optional[List[Dict[str, Any]]] = None,
        description: Optional[str] = None,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        business_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create an A/B test (ad study) via Meta's ad_studies endpoint.
        
        Per Meta Split Testing docs:
        - POST /{BUSINESS_ID}/ad_studies or POST /act_{ACCOUNT_ID}/ad_studies
        - Cells should contain: name, treatment_percentage, and campaigns or adsets arrays
        """
        try:
            import httpx
            
            # Build endpoint URL - prefer business_id if provided
            if business_id:
                url = f"https://graph.facebook.com/{META_API_VERSION}/{business_id}/ad_studies"
            else:
                url = f"https://graph.facebook.com/{META_API_VERSION}/act_{account_id}/ad_studies"
            
            # Build cells in Meta's required format
            study_cells = []
            for cell in (cells or []):
                cell_data = {
                    "name": cell.get("name", "Unnamed"),
                    "treatment_percentage": cell.get("treatment_percentage", 50)
                }
                # Add campaigns or adsets (use one or the other per docs)
                if cell.get("campaigns"):
                    cell_data["campaigns"] = cell["campaigns"]
                elif cell.get("adsets"):
                    cell_data["adsets"] = cell["adsets"]
                study_cells.append(cell_data)
            
            appsecret_proof = self._get_appsecret_proof()
            
            params = {
                "access_token": self.access_token,
                "name": name,
                "type": test_type,
                "cells": json.dumps(study_cells)  # Must be JSON-encoded string
            }
            
            if appsecret_proof:
                params["appsecret_proof"] = appsecret_proof
            if description:
                params["description"] = description
            if start_time:
                params["start_time"] = start_time
            if end_time:
                params["end_time"] = end_time
            
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, data=params)
                
                if response.is_success:
                    result = response.json()
                    return {
                        "success": True,
                        "test_id": result.get("id"),
                        "id": result.get("id"),
                        "name": name
                    }
                else:
                    error_detail = response.json()
                    return {
                        "success": False,
                        "error": error_detail.get("error", {}).get("message", "Failed to create A/B test")
                    }
                    
        except Exception as e:
            logger.error(f"Create A/B test error: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_ab_test(
        self,
        account_id: str,
        name: str,
        test_type: str = "SPLIT_TEST",
        cells: Optional[List[Dict[str, Any]]] = None,
        description: Optional[str] = None,
        start_time: Optional[int] = None,
        end_time: Optional[int] = None,
        business_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create an A/B test (ad study).
        
        Args:
            account_id: Ad Account ID
            name: Test name
            test_type: SPLIT_TEST, MULTI_CELL_TEST, HOLDOUT
            cells: List of test cells with name, treatment_percentage, campaigns/adsets
            description: Test description
            start_time: Unix timestamp for start
            end_time: Unix timestamp for end
            business_id: Optional business ID (preferred over account_id)
            
        Returns:
            Dict with test_id
        """
        return await asyncio.to_thread(
            self._create_ab_test_sync,
            account_id,
            name,
            test_type,
            cells,
            description,
            start_time,
            end_time,
            business_id
        )
    
    def _get_ad_studies_sync(self, business_id: str) -> Dict[str, Any]:
        """Get all A/B tests (ad studies) for a business"""
        try:
            self._init_api()
            
            business = Business(fbid=business_id)
            studies = business.get_ad_studies(fields=[
                'id', 'name', 'type', 'description', 'start_time', 'end_time',
                'observation_end_time', 'created_time', 'updated_time', 'cooldown_start_time'
            ])
            
            result = []
            for study in studies:
                status = self._calculate_status(
                    study.get('start_time'),
                    study.get('end_time')
                )
                
                study_data = {
                    'id': study['id'],
                    'name': study.get('name'),
                    'type': study.get('type', 'SPLIT_TEST'),
                    'description': study.get('description'),
                    'status': status,
                    'start_time': study.get('start_time'),
                    'end_time': study.get('end_time'),
                    'observation_end_time': study.get('observation_end_time'),
                    'cooldown_start_time': study.get('cooldown_start_time'),
                    'created_time': study.get('created_time'),
                    'updated_time': study.get('updated_time'),
                    'cells': []
                }
                
                # Fetch cells via edge
                try:
                    cells = study.get_cells(fields=[
                        'id', 'name', 'treatment_percentage', 
                        'adaccounts', 'adsets', 'campaigns'
                    ])
                    for i, c in enumerate(cells):
                        adsets_data = c.get('adsets', {})
                        campaigns_data = c.get('campaigns', {})
                        
                        adsets_list = adsets_data.get('data', []) if isinstance(adsets_data, dict) else (adsets_data or [])
                        campaigns_list = campaigns_data.get('data', []) if isinstance(campaigns_data, dict) else (campaigns_data or [])
                        
                        def extract_id(item):
                            if item is None:
                                return None
                            if isinstance(item, str):
                                return item
                            if isinstance(item, dict):
                                return item.get('id')
                            if hasattr(item, 'get'):
                                return item.get('id')
                            if hasattr(item, 'id'):
                                return item.id
                            return str(item)
                        
                        study_data['cells'].append({
                            'id': c['id'], 
                            'name': c.get('name', f'Cell {i+1}'),
                            'treatment_percentage': c.get('treatment_percentage', 0),
                            'adsets': [extract_id(item) for item in adsets_list if extract_id(item)],
                            'campaigns': [extract_id(item) for item in campaigns_list if extract_id(item)],
                            'adsets_count': len(adsets_list),
                            'campaigns_count': len(campaigns_list),
                        })
                except Exception as e:
                    logger.warning(f"Failed to fetch cells for study {study['id']}: {e}")
                
                result.append(study_data)
            
            return {"success": True, "studies": result}
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Get ad studies error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_ad_studies(self, business_id: str) -> Dict[str, Any]:
        """
        Get all A/B tests for a business.
        
        Args:
            business_id: Business ID
            
        Returns:
            Dict with list of study dicts
        """
        return await asyncio.to_thread(self._get_ad_studies_sync, business_id)
    
    def _get_ad_study_details_sync(self, study_id: str) -> Dict[str, Any]:
        """Get details of a specific A/B test"""
        try:
            self._init_api()
            
            from facebook_business.adobjects.adstudy import AdStudy
            
            study = AdStudy(fbid=study_id)
            study_data = study.api_get(fields=[
                'id', 'name', 'type', 'description', 'start_time', 'end_time',
                'observation_end_time', 'created_time', 'updated_time', 'cooldown_start_time',
                'canceled_time', 'business'
            ])
            
            status = self._calculate_status(
                study_data.get('start_time'),
                study_data.get('end_time'),
                study_data.get('canceled_time')
            )
            
            # Fetch cells
            cells = []
            try:
                cells_data = study.get_cells(fields=[
                    'id', 'name', 'treatment_percentage', 
                    'adaccounts', 'adsets', 'campaigns'
                ])
                for i, c in enumerate(cells_data):
                    adsets_data = c.get('adsets', {})
                    campaigns_data = c.get('campaigns', {})
                    adsets_list = adsets_data.get('data', []) if isinstance(adsets_data, dict) else (adsets_data or [])
                    campaigns_list = campaigns_data.get('data', []) if isinstance(campaigns_data, dict) else (campaigns_data or [])
                    
                    def extract_id(item):
                        if item is None:
                            return None
                        if isinstance(item, str):
                            return item
                        if isinstance(item, dict):
                            return item.get('id')
                        if hasattr(item, 'get'):
                            return item.get('id')
                        if hasattr(item, 'id'):
                            return item.id
                        return str(item)
                    
                    cells.append({
                        'id': c['id'],
                        'name': c.get('name', f'Cell {i+1}'),
                        'treatment_percentage': c.get('treatment_percentage', 0),
                        'adsets': [extract_id(item) for item in adsets_list if extract_id(item)],
                        'campaigns': [extract_id(item) for item in campaigns_list if extract_id(item)],
                    })
            except Exception as e:
                logger.warning(f"Failed to fetch cells for study {study_id}: {e}")
            
            return {
                "success": True,
                "study": {
                    'id': study_data.get('id'),
                    'name': study_data.get('name'),
                    'type': study_data.get('type', 'SPLIT_TEST'),
                    'description': study_data.get('description'),
                    'status': status,
                    'start_time': study_data.get('start_time'),
                    'end_time': study_data.get('end_time'),
                    'observation_end_time': study_data.get('observation_end_time'),
                    'cooldown_start_time': study_data.get('cooldown_start_time'),
                    'created_time': study_data.get('created_time'),
                    'updated_time': study_data.get('updated_time'),
                    'canceled_time': study_data.get('canceled_time'),
                    'cells': cells,
                    'cells_count': len(cells)
                }
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Get ad study details error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_ad_study_details(self, study_id: str) -> Dict[str, Any]:
        """
        Get A/B test details.
        
        Args:
            study_id: Study ID
            
        Returns:
            Dict with study details
        """
        return await asyncio.to_thread(self._get_ad_study_details_sync, study_id)
    
    def _get_ad_study_insights_sync(
        self,
        study_id: str,
        date_preset: str = "last_7d"
    ) -> Dict[str, Any]:
        """Get performance insights for an A/B test"""
        try:
            self._init_api()
            
            from facebook_business.adobjects.adstudy import AdStudy
            from facebook_business.adobjects.adset import AdSet
            
            study = AdStudy(fbid=study_id)
            study_data = study.api_get(fields=['cells'])
            
            cells_data = []
            for cell in study_data.get('cells', []):
                cell_data = {
                    'name': cell.get('name', 'Unknown'),
                    'treatment_percentage': cell.get('treatment_percentage', 0),
                    'spend': 0,
                    'impressions': 0,
                    'clicks': 0,
                    'ctr': 0,
                    'cost_per_result': 0
                }
                
                for adset_id in cell.get('adsets', []):
                    try:
                        adset = AdSet(fbid=adset_id)
                        insights = adset.get_insights(
                            fields=['spend', 'impressions', 'clicks'],
                            params={'date_preset': date_preset}
                        )
                        if insights:
                            insight = insights[0]
                            cell_data['spend'] += float(insight.get('spend', 0))
                            cell_data['impressions'] += int(insight.get('impressions', 0))
                            cell_data['clicks'] += int(insight.get('clicks', 0))
                    except:
                        pass
                
                if cell_data['impressions'] > 0:
                    cell_data['ctr'] = (cell_data['clicks'] / cell_data['impressions']) * 100
                if cell_data['clicks'] > 0:
                    cell_data['cost_per_result'] = cell_data['spend'] / cell_data['clicks']
                
                cells_data.append(cell_data)
            
            return {"success": True, "cells": cells_data}
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Get ad study insights error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_ad_study_insights(
        self,
        study_id: str,
        date_preset: str = "last_7d"
    ) -> Dict[str, Any]:
        """
        Get A/B test insights.
        
        Args:
            study_id: Study ID
            date_preset: Date preset for metrics
            
        Returns:
            Dict with cell performance data
        """
        return await asyncio.to_thread(
            self._get_ad_study_insights_sync,
            study_id,
            date_preset
        )
    
    def _update_ad_study_sync(
        self,
        study_id: str,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update an A/B test"""
        try:
            self._init_api()
            
            from facebook_business.adobjects.adstudy import AdStudy
            
            study = AdStudy(fbid=study_id)
            if status:
                study.api_update(params={'status': status})
            
            return {"success": True, "id": study_id}
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Update ad study error: {e}")
            return {"success": False, "error": str(e)}
    
    async def update_ad_study(
        self,
        study_id: str,
        status: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Update A/B test.
        
        Args:
            study_id: Study ID
            status: New status
            
        Returns:
            Dict with success status
        """
        return await asyncio.to_thread(
            self._update_ad_study_sync,
            study_id,
            status
        )
    
    def _delete_ad_study_sync(self, study_id: str) -> Dict[str, Any]:
        """Delete/cancel an A/B test"""
        try:
            self._init_api()
            
            from facebook_business.adobjects.adstudy import AdStudy
            
            study = AdStudy(fbid=study_id)
            study.api_delete()
            
            return {"success": True, "id": study_id}
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Delete ad study error: {e}")
            return {"success": False, "error": str(e)}
    
    async def delete_ad_study(self, study_id: str) -> Dict[str, Any]:
        """
        Delete A/B test.
        
        Args:
            study_id: Study ID
            
        Returns:
            Dict with success status
        """
        return await asyncio.to_thread(self._delete_ad_study_sync, study_id)

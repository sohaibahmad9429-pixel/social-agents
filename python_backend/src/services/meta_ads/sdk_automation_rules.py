"""
SDK Automation Rules Service
Meta Business SDK - Ad Automation Rules

Uses:
- Graph API for ad rules management
- Create, update, delete automation rules for campaigns/adsets/ads
"""
import asyncio
import logging
from typing import Optional, Dict, Any, List

from ...config import settings

logger = logging.getLogger(__name__)

# API Version
META_API_VERSION = "v24.0"

# Available rule actions
RULE_ACTIONS = [
    "PAUSE",
    "UNPAUSE",
    "CHANGE_BUDGET",
    "CHANGE_BID",
    "SEND_NOTIFICATION",
    "REQUEST_CREATIVE_ASSET",
    "CHANGE_ADSET_STATUS",
    "SEND_EMAIL",
]

# Available evaluation types
EVALUATION_TYPES = [
    "SCHEDULE",       # Runs on a schedule
    "TRIGGER"         # Runs on event
]


class AutomationRulesService:
    """Service for Meta ad automation rules."""
    
    def __init__(self, access_token: str):
        """
        Initialize Automation Rules Service.
        
        Args:
            access_token: User access token with ads_management permission
        """
        self.access_token = access_token
    
    def _get_automation_rules_sync(self, account_id: str) -> Dict[str, Any]:
        """Get all automation rules for an ad account."""
        try:
            import httpx
            
            if not account_id.startswith('act_'):
                account_id = f'act_{account_id}'
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{account_id}/adrules_library"
            params = {
                "access_token": self.access_token,
                "fields": "id,name,status,evaluation_spec,execution_spec,schedule_spec,created_time,updated_time"
            }
            
            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, params=params)
                
                if response.is_success:
                    data = response.json()
                    return {
                        "success": True,
                        "rules": data.get("data", [])
                    }
                else:
                    error_data = response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Failed to fetch rules")
                    }
                    
        except Exception as e:
            logger.error(f"Get automation rules error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_automation_rules(self, account_id: str) -> Dict[str, Any]:
        """
        Get all automation rules for an account.
        
        Args:
            account_id: Ad Account ID
            
        Returns:
            Dict with list of rule dicts
        """
        return await asyncio.to_thread(self._get_automation_rules_sync, account_id)
    
    def _get_automation_rule_sync(self, rule_id: str) -> Dict[str, Any]:
        """Get details of a specific automation rule."""
        try:
            import httpx
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{rule_id}"
            params = {
                "access_token": self.access_token,
                "fields": "id,name,status,evaluation_spec,execution_spec,schedule_spec,created_time,updated_time"
            }
            
            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, params=params)
                
                if response.is_success:
                    return {"success": True, "rule": response.json()}
                else:
                    error_data = response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Failed to get rule")
                    }
                    
        except Exception as e:
            logger.error(f"Get automation rule error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_automation_rule(self, rule_id: str) -> Dict[str, Any]:
        """
        Get details of a specific automation rule.
        
        Args:
            rule_id: Rule ID
            
        Returns:
            Dict with rule details
        """
        return await asyncio.to_thread(self._get_automation_rule_sync, rule_id)
    
    def _create_automation_rule_sync(
        self,
        account_id: str,
        name: str,
        evaluation_spec: Dict[str, Any],
        execution_spec: Dict[str, Any],
        schedule_spec: Optional[Dict[str, Any]] = None,
        status: str = "ENABLED"
    ) -> Dict[str, Any]:
        """
        Create a new automation rule.
        
        Per Meta docs: POST /{account-id}/adrules_library
        
        Args:
            account_id: Ad Account ID
            name: Rule name
            evaluation_spec: Conditions to evaluate
            execution_spec: Actions to take
            schedule_spec: When to run
            status: ENABLED or DISABLED
        """
        try:
            import httpx
            import json
            
            if not account_id.startswith('act_'):
                account_id = f'act_{account_id}'
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{account_id}/adrules_library"
            
            data = {
                "access_token": self.access_token,
                "name": name,
                "evaluation_spec": json.dumps(evaluation_spec),
                "execution_spec": json.dumps(execution_spec),
                "status": status
            }
            
            if schedule_spec:
                data["schedule_spec"] = json.dumps(schedule_spec)
            
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, data=data)
                
                if response.is_success:
                    result = response.json()
                    return {
                        "success": True,
                        "id": result.get("id"),
                        "rule_id": result.get("id")
                    }
                else:
                    error_data = response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Failed to create rule")
                    }
                    
        except Exception as e:
            logger.error(f"Create automation rule error: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_automation_rule(
        self,
        account_id: str,
        name: str,
        evaluation_spec: Dict[str, Any],
        execution_spec: Dict[str, Any],
        schedule_spec: Optional[Dict[str, Any]] = None,
        status: str = "ENABLED"
    ) -> Dict[str, Any]:
        """
        Create a new automation rule.
        
        Args:
            account_id: Ad Account ID
            name: Rule name
            evaluation_spec: Conditions to evaluate
            execution_spec: Actions to take
            schedule_spec: When to run
            status: ENABLED or DISABLED
            
        Returns:
            Dict with rule_id
        """
        return await asyncio.to_thread(
            self._create_automation_rule_sync,
            account_id,
            name,
            evaluation_spec,
            execution_spec,
            schedule_spec,
            status
        )
    
    def _update_automation_rule_sync(
        self,
        rule_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update an existing automation rule."""
        try:
            import httpx
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{rule_id}"
            
            params = {"access_token": self.access_token, **updates}
            
            with httpx.Client(timeout=30.0) as client:
                response = client.post(url, json=params)
                
                if response.is_success:
                    return {"success": True, "rule_id": rule_id}
                else:
                    error_data = response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Failed to update rule")
                    }
                    
        except Exception as e:
            logger.error(f"Update automation rule error: {e}")
            return {"success": False, "error": str(e)}
    
    async def update_automation_rule(
        self,
        rule_id: str,
        updates: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Update an automation rule.
        
        Args:
            rule_id: Rule ID
            updates: Fields to update
            
        Returns:
            Dict with success status
        """
        return await asyncio.to_thread(
            self._update_automation_rule_sync,
            rule_id,
            updates
        )
    
    def _delete_automation_rule_sync(self, rule_id: str) -> Dict[str, Any]:
        """Delete an automation rule."""
        try:
            import httpx
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{rule_id}"
            params = {"access_token": self.access_token}
            
            with httpx.Client(timeout=30.0) as client:
                response = client.delete(url, params=params)
                
                if response.is_success:
                    return {"success": True}
                else:
                    error_data = response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Failed to delete rule")
                    }
                    
        except Exception as e:
            logger.error(f"Delete automation rule error: {e}")
            return {"success": False, "error": str(e)}
    
    async def delete_automation_rule(self, rule_id: str) -> Dict[str, Any]:
        """
        Delete an automation rule.
        
        Args:
            rule_id: Rule ID
            
        Returns:
            Dict with success status
        """
        return await asyncio.to_thread(self._delete_automation_rule_sync, rule_id)
    
    def _get_rule_history_sync(
        self,
        rule_id: str,
        limit: int = 25,
        action: Optional[str] = None,
        hide_no_changes: bool = False
    ) -> Dict[str, Any]:
        """
        Get execution history for an automation rule.
        
        Args:
            rule_id: The rule ID
            limit: Max number of history entries to return
            action: Filter by action (PAUSE, UNPAUSE, CHANGE_BUDGET, etc.)
            hide_no_changes: If True, exclude entries with no results
        
        Per Meta docs: /{ad-rule-id}/history endpoint
        """
        try:
            import httpx
            
            url = f"https://graph.facebook.com/{META_API_VERSION}/{rule_id}/history"
            params = {
                "access_token": self.access_token,
                "limit": limit,
                "fields": "exception_code,exception_message,is_manual,results,rule_id,schedule_spec,time"
            }
            
            if action:
                params["action"] = action
            if hide_no_changes:
                params["hide_no_changes"] = "true"
            
            with httpx.Client(timeout=30.0) as client:
                response = client.get(url, params=params)
                
                if response.is_success:
                    data = response.json()
                    return {
                        "success": True,
                        "history": data.get("data", []),
                        "paging": data.get("paging")
                    }
                else:
                    error_data = response.json()
                    return {
                        "success": False,
                        "error": error_data.get("error", {}).get("message", "Failed to get rule history")
                    }
                    
        except Exception as e:
            logger.error(f"Get rule history error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_rule_history(
        self,
        rule_id: str,
        limit: int = 25,
        action: Optional[str] = None,
        hide_no_changes: bool = False
    ) -> Dict[str, Any]:
        """
        Get execution history for an automation rule.
        
        Args:
            rule_id: Rule ID
            limit: Max entries to return
            action: Filter by action type
            hide_no_changes: Exclude entries with no results
            
        Returns:
            Dict with list of history entries
        """
        return await asyncio.to_thread(
            self._get_rule_history_sync,
            rule_id,
            limit,
            action,
            hide_no_changes
        )

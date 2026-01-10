"""
SDK Product Catalogs Service
Meta Business SDK - Product Catalog API

Uses:
- facebook_business.adobjects.productcatalog
- facebook_business.adobjects.business
- Manage product catalogs, products, and product sets
"""
import asyncio
import logging
from typing import Optional, Dict, Any, List

from facebook_business.adobjects.business import Business
from facebook_business.exceptions import FacebookRequestError

from ...config import settings

logger = logging.getLogger(__name__)

# API Version
META_API_VERSION = "v24.0"

# Catalog verticals
CATALOG_VERTICALS = [
    "commerce",       # E-commerce products
    "hotels",         # Hotel listings
    "flights",        # Flight listings
    "destinations",   # Travel destinations
    "home_listings",  # Real estate
    "vehicles",       # Automotive
    "ticketed_experiences"  # Events
]


class CatalogsService:
    """Service for Meta product catalog operations using SDK."""
    
    def __init__(self, access_token: str):
        """
        Initialize Catalogs Service.
        
        Args:
            access_token: User access token with business_management permission
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
    
    def _get_catalogs_sync(self, business_id: str) -> Dict[str, Any]:
        """Get product catalogs owned by a business"""
        try:
            self._init_api()
            
            business = Business(fbid=business_id)
            catalogs = business.get_owned_product_catalogs(fields=[
                'id',
                'name',
                'product_count',
                'vertical',
                'business'
            ])
            
            result = [
                {
                    'id': cat['id'],
                    'name': cat.get('name'),
                    'product_count': cat.get('product_count'),
                    'vertical': cat.get('vertical'),
                    'business_id': cat.get('business', {}).get('id') if cat.get('business') else None
                }
                for cat in catalogs
            ]
            
            return {"success": True, "catalogs": result}
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Get catalogs error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_catalogs(self, business_id: str) -> Dict[str, Any]:
        """
        Get product catalogs owned by a business.
        
        Args:
            business_id: Business ID
            
        Returns:
            Dict with list of catalog dicts with id, name, product_count
        """
        return await asyncio.to_thread(self._get_catalogs_sync, business_id)
    
    def _create_catalog_sync(
        self,
        business_id: str,
        name: str,
        vertical: str = 'commerce'
    ) -> Dict[str, Any]:
        """Create a new product catalog"""
        try:
            self._init_api()
            
            business = Business(fbid=business_id)
            result = business.create_owned_product_catalog(params={
                'name': name,
                'vertical': vertical
            })
            
            return {
                "success": True,
                'id': result.get('id'),
                'catalog_id': result.get('id')
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Create catalog error: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_catalog(
        self,
        business_id: str,
        name: str,
        vertical: str = 'commerce'
    ) -> Dict[str, Any]:
        """
        Create a new product catalog.
        
        Args:
            business_id: Business ID
            name: Catalog name
            vertical: commerce, hotels, flights, destinations, etc.
            
        Returns:
            Dict with catalog_id
        """
        return await asyncio.to_thread(
            self._create_catalog_sync,
            business_id,
            name,
            vertical
        )
    
    def _get_catalog_products_sync(
        self,
        catalog_id: str,
        limit: int = 100
    ) -> Dict[str, Any]:
        """Get products from a catalog"""
        try:
            self._init_api()
            
            from facebook_business.adobjects.productcatalog import ProductCatalog
            
            catalog = ProductCatalog(fbid=catalog_id)
            products = catalog.get_products(fields=[
                'id',
                'retailer_id',
                'name',
                'description',
                'price',
                'currency',
                'availability',
                'image_url',
                'url'
            ], params={'limit': limit})
            
            result = [
                {
                    'id': prod['id'],
                    'retailer_id': prod.get('retailer_id'),
                    'name': prod.get('name'),
                    'description': prod.get('description'),
                    'price': prod.get('price'),
                    'currency': prod.get('currency'),
                    'availability': prod.get('availability'),
                    'image_url': prod.get('image_url'),
                    'url': prod.get('url')
                }
                for prod in products
            ]
            
            return {"success": True, "products": result}
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Get catalog products error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_catalog_products(
        self,
        catalog_id: str,
        limit: int = 100
    ) -> Dict[str, Any]:
        """
        Get products from a product catalog.
        
        Args:
            catalog_id: Catalog ID
            limit: Max products to return
            
        Returns:
            Dict with list of product dicts
        """
        return await asyncio.to_thread(
            self._get_catalog_products_sync,
            catalog_id,
            limit
        )
    
    def _add_products_to_catalog_sync(
        self,
        catalog_id: str,
        products: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Add products to catalog using batch API.
        
        Each product should have:
        - retailer_id: Unique product ID
        - name: Product name
        - description: Product description
        - price: Price as string (e.g., "19.99 USD")
        - availability: 'in stock', 'out of stock', etc.
        - url: Product URL
        - image_url: Product image URL
        """
        try:
            self._init_api()
            
            from facebook_business.adobjects.productcatalog import ProductCatalog
            
            catalog = ProductCatalog(fbid=catalog_id)
            
            # Format products for batch API
            requests = []
            for prod in products:
                item_data = {
                    'retailer_id': prod['retailer_id'],
                    'data': {
                        'name': prod.get('name', ''),
                        'description': prod.get('description', ''),
                        'price': prod.get('price', '0.00 USD'),
                        'availability': prod.get('availability', 'in stock'),
                        'url': prod.get('url', ''),
                        'image_url': prod.get('image_url', '')
                    }
                }
                requests.append(item_data)
            
            # Use items_batch endpoint
            result = catalog.create_items_batch(params={
                'requests': requests
            })
            
            return {
                "success": True,
                'handle': result.get('handles', [])
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Add products to catalog error: {e}")
            return {"success": False, "error": str(e)}
    
    async def add_products_to_catalog(
        self,
        catalog_id: str,
        products: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Add products to a catalog.
        
        Args:
            catalog_id: Catalog ID
            products: List of product dicts with retailer_id, name, price, etc.
            
        Returns:
            Dict with batch handle
        """
        return await asyncio.to_thread(
            self._add_products_to_catalog_sync,
            catalog_id,
            products
        )
    
    def _get_product_sets_sync(self, catalog_id: str) -> Dict[str, Any]:
        """Get product sets from a catalog"""
        try:
            self._init_api()
            
            from facebook_business.adobjects.productcatalog import ProductCatalog
            
            catalog = ProductCatalog(fbid=catalog_id)
            product_sets = catalog.get_product_sets(fields=[
                'id',
                'name',
                'product_count',
                'filter'
            ])
            
            result = [
                {
                    'id': ps['id'],
                    'name': ps.get('name'),
                    'product_count': ps.get('product_count'),
                    'filter': ps.get('filter')
                }
                for ps in product_sets
            ]
            
            return {"success": True, "product_sets": result}
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Get product sets error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_product_sets(self, catalog_id: str) -> Dict[str, Any]:
        """
        Get product sets from a catalog.
        
        Args:
            catalog_id: Catalog ID
            
        Returns:
            Dict with list of product set dicts
        """
        return await asyncio.to_thread(self._get_product_sets_sync, catalog_id)
    
    def _create_product_set_sync(
        self,
        catalog_id: str,
        name: str,
        filter_rules: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Create a product set (subset of catalog products)"""
        try:
            self._init_api()
            
            from facebook_business.adobjects.productcatalog import ProductCatalog
            
            catalog = ProductCatalog(fbid=catalog_id)
            
            params = {'name': name}
            if filter_rules:
                params['filter'] = filter_rules
            
            result = catalog.create_product_set(params=params)
            
            return {
                "success": True,
                'id': result.get('id'),
                'product_set_id': result.get('id')
            }
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Create product set error: {e}")
            return {"success": False, "error": str(e)}
    
    async def create_product_set(
        self,
        catalog_id: str,
        name: str,
        filter_rules: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Create a product set from catalog products.
        
        Args:
            catalog_id: Catalog ID
            name: Product set name
            filter_rules: Optional filter rules (e.g., by category, price)
            
        Returns:
            Dict with product_set_id
        """
        return await asyncio.to_thread(
            self._create_product_set_sync,
            catalog_id,
            name,
            filter_rules
        )
    
    def _delete_product_sync(self, product_id: str) -> Dict[str, Any]:
        """Delete a product from catalog"""
        try:
            self._init_api()
            
            from facebook_business.adobjects.productitem import ProductItem
            
            product = ProductItem(fbid=product_id)
            product.api_delete()
            
            return {"success": True}
            
        except FacebookRequestError as e:
            logger.error(f"Facebook API error: {e}")
            return {"success": False, "error": str(e)}
        except Exception as e:
            logger.error(f"Delete product error: {e}")
            return {"success": False, "error": str(e)}
    
    async def delete_product(self, product_id: str) -> Dict[str, Any]:
        """
        Delete a product from catalog.
        
        Args:
            product_id: Product ID to delete
            
        Returns:
            Dict with success status
        """
        return await asyncio.to_thread(self._delete_product_sync, product_id)

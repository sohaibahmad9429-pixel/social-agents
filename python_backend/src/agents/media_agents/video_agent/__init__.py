"""Video Agent - Google Veo 3.1"""
from .service import (
    generate_video,
    generate_image_to_video,
    generate_frame_specific,
    generate_with_references,
    extend_video,
    get_video_status,
    download_video,
)
from .schemas import (
    VideoGenerationRequest,
    VideoGenerationResponse,
    VideoStatusRequest,
    VideoStatusResponse,
    VideoDownloadRequest,
    VideoDownloadResponse,
    ImageToVideoRequest,
    FrameSpecificRequest,
    ReferenceImagesRequest,
    ReferenceImage,
    VideoExtendRequest,
    VideoData,
    VEO_MODELS,
    VEO_ASPECT_RATIOS,
    VEO_DURATIONS,
    VEO_RESOLUTIONS,
)

__all__ = [
    # Service functions
    "generate_video",
    "generate_image_to_video",
    "generate_frame_specific",
    "generate_with_references",
    "extend_video",
    "get_video_status",
    "download_video",
    # Request schemas
    "VideoGenerationRequest",
    "ImageToVideoRequest",
    "FrameSpecificRequest",
    "ReferenceImagesRequest",
    "ReferenceImage",
    "VideoExtendRequest",
    "VideoStatusRequest",
    "VideoDownloadRequest",
    # Response schemas
    "VideoGenerationResponse",
    "VideoStatusResponse",
    "VideoDownloadResponse",
    "VideoData",
    # Constants
    "VEO_MODELS",
    "VEO_ASPECT_RATIOS",
    "VEO_DURATIONS",
    "VEO_RESOLUTIONS",
]

/**
 * 广告信息接口定义
 */
export interface AdInfo {
  ad_archive_id: string;
  page_name?: string;
  page_id?: string;
  link_url?: string;
  caption?: string;
  cta_text?: string;
  page_like_count?: number;
  start_date?: number; // unix timestamp
}

/**
 * 媒体资源接口定义
 */
export interface MediaResource {
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
}

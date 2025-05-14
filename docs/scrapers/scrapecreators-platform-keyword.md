Endpoint: GET https://api.scrapecreators.com/v1/tiktok/search/keyword
  
  Description: Scrapes TikTok videos matching a keyword
  
  Required Headers:
  - x-api-key: Your API key
  
  Parameters:
  - query (string) (Required): Keyword to search for
- cursor (number): Cursor to get more videos. Get 'cursor' from previous response.
- date_posted (select): Time Frame
  
  Example Response:
  {
  "cursor": 12,
  "search_item_list": [
    {
      "aweme_info": {
        "added_sound_music_info": {
          "album": "Yeah! (feat. Lil Jon & Ludacris)",
          "allow_offline_music_to_detail_page": false,
          "artists": [
            {
              "avatar": {
                "uri": "tos-maliva-avt-0068/122719f01f36ed8578e8299237f9cdce",
                "url_list": [
                  "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/122719f01f36ed8578e8299237f9cdce~tplv-tiktokx-cropcenter-q:168:168:q75.webp?dr=9604&idc=no1a&nonce=55741&ps=87d6e48a&refresh_token=da514b973402e5a0d5fcd41636b64929&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4",
                  "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/122719f01f36ed8578e8299237f9cdce~tplv-tiktokx-cropcenter-q:168:168:q75.jpeg?dr=9604&idc=no1a&nonce=74470&ps=87d6e48a&refresh_token=98917cc387db6d79e33774c79a5da3ca&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4"
                ],
                "url_prefix": null
              },
              "enter_type": 2,
              "follow_status": 0,
              "follower_status": 0,
              "handle": "usher",
              "is_block": false,
              "is_blocked": false,
              "is_private_account": false,
              "is_verified": true,
              "is_visible": false,
              "nick_name": "Usher Raymond",
              "sec_uid": "MS4wLjABAAAA2qFUyY878XlTp6vlLi2LWROamZKwkQfqRLMHo8O0UizXpnO-yXE2qR7QZKRCJJy_",
              "status": 1,
              "uid": "6779798771846431749"
            },
            {
              "avatar": {
                "uri": "tos-maliva-avt-0068/7316288117144485894",
                "url_list": [
                  "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/7316288117144485894~tplv-tiktokx-cropcenter-q:168:168:q75.webp?dr=9604&idc=no1a&nonce=79543&ps=87d6e48a&refresh_token=182adee6003a62a55372347a693e4934&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4",
                  "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/7316288117144485894~tplv-tiktokx-cropcenter-q:168:168:q75.jpeg?dr=9604&idc=no1a&nonce=57038&ps=87d6e48a&refresh_token=83f0ce8a0342e43b0c79dc733d8e2cd5&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4"
                ],
                "url_prefix": null
              },
              "enter_type": 2,
              "follow_status": 0,
              "follower_status": 0,
              "handle": "liljon",
              "is_block": false,
              "is_blocked": false,
              "is_private_account": false,
              "is_verified": true,
              "is_visible": false,
              "nick_name": "Lil Jon",
              "sec_uid": "MS4wLjABAAAAIijhe2POnJU-xRffTq5KyI2Q8tOHEPOKD1uNFL3IvjzIvuC5Lv401YQEgsTY_Fvi",
              "status": 1,
              "uid": "6533676606852961280"
            }
          ],
          "audition_duration": 60,
          "author": "Usher",
          "author_deleted": false,
          "author_position": null,
          "avatar_medium": {
            "height": 720,
            "uri": "tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d",
            "url_list": [
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:720:720:q75.webp?dr=9607&idc=no1a&nonce=17377&ps=87d6e48a&refresh_token=77046454af816fde091c2cbfc94ae998&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4",
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:720:720:q75.jpeg?dr=9607&idc=no1a&nonce=68123&ps=87d6e48a&refresh_token=a3df0b591282b09d3672f88678bc0a4d&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4"
            ],
            "url_prefix": null,
            "width": 720
          },
          "avatar_thumb": {
            "height": 720,
            "uri": "tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d",
            "url_list": [
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:100:100:q75.webp?dr=9606&idc=no1a&nonce=88621&ps=87d6e48a&refresh_token=a2a2bc1faf0d645ac7826709b90b86fe&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4",
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:100:100:q75.jpeg?dr=9606&idc=no1a&nonce=24693&ps=87d6e48a&refresh_token=31984de7c9ac6e195e32e8d579e7f701&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4"
            ],
            "url_prefix": null,
            "width": 720
          },
          "binded_challenge_id": 0,
          "can_be_stitched": false,
          "can_not_reuse": false,
          "collect_stat": 0,
          "commercial_right_type": 3,
          "cover_large": {
            "height": 720,
            "uri": "tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b",
            "url_list": [
              "https://p16-sg.tiktokcdn.com/aweme/720x720/tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b.jpeg"
            ],
            "url_prefix": null,
            "width": 720
          },
          "cover_medium": {
            "height": 720,
            "uri": "tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b",
            "url_list": [
              "https://p16-sg.tiktokcdn.com/aweme/200x200/tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b.jpeg"
            ],
            "url_prefix": null,
            "width": 720
          },
          "cover_thumb": {
            "height": 720,
            "uri": "tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b",
            "url_list": [
              "https://p16-sg.tiktokcdn.com/aweme/100x100/tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b.jpeg"
            ],
            "url_prefix": null,
            "width": 720
          },
          "create_time": 1646767514,
          "dmv_auto_show": false,
          "duration": 60,
          "duration_high_precision": {
            "audition_duration_precision": 60,
            "duration_precision": 60,
            "shoot_duration_precision": 60,
            "video_duration_precision": 60
          },
          "external_song_info": [],
          "extra": "{\"amplitude_peak\":1.1201035,\"beats\":{\"audio_effect_onset\":\"https://sf77-ies-music-sg.tiktokcdn.com/obj/tos-alisg-v-2774/439648c9db134eeea4626f1441f4fd85\",\"beats_tracker\":\"https://sf16-ies-music-sg.tiktokcdn.com/obj/tos-alisg-v-2774/2f63338020c14f2ead895158393d1688\",\"energy_trace\":\"https://sf16-ies-music-sg.tiktokcdn.com/obj/tos-alisg-v-2774/fc7e1ef3c7ab4fc997b8f5e657f86cab\",\"merged_beats\":\"https://sf77-ies-music-sg.tiktokcdn.com/obj/tos-alisg-v-2774/a3f0715ab5304acdb93e0e44c2911884\"},\"can_read\":true,\"can_reuse\":true,\"erase_type\":0,\"erase_uid\":0,\"from_user_id\":7339876632230134816,\"full_song_beat_info\":{},\"full_song_beats\":{},\"has_edited\":0,\"is_batch_take_down_music\":false,\"is_ugc_mapping\":false,\"is_used\":0,\"loudness_lufs\":-9.173245,\"music_vid\":\"v10ad6g50000cc1h183c77u9c47ldr4g\",\"owner_id\":0,\"resource_status\":0,\"review_unshelve_reason\":0,\"reviewed\":1,\"schedule_search_time\":0}",
          "has_commerce_right": false,
          "id": 7072812562194106000,
          "id_str": "7072812562194106370",
          "is_audio_url_with_cookie": false,
          "is_author_artist": true,
          "is_commerce_music": true,
          "is_matched_metadata": false,
          "is_original": false,
          "is_original_sound": false,
          "is_pgc": true,
          "is_play_music": true,
          "is_shooting_allow": true,
          "language": "English",
          "log_extra": "{\"meta_song_matched_type\":\"pgc\",\"ttm_matched_type\":\"\",\"ttm_track_id\":\"\",\"matched_meta_song_id\":\"\",\"vid\":\"\",\"owner_id\":\"\"}",
          "lyric_short_position": null,
          "matched_song": {
            "author": "Usher",
            "chorus_info": {
              "duration_ms": 27455,
              "start_ms": 56064
            },
            "cover_medium": {
              "height": 720,
              "uri": "tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b",
              "url_list": [
                "https://p16-sg.tiktokcdn.com/aweme/200x200/tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b.jpeg"
              ],
              "url_prefix": null,
              "width": 720
            },
            "full_duration": 250420,
            "h5_url": "",
            "id": "7072812557722978305",
            "performers": null,
            "title": "Yeah! (feat. Lil Jon & Ludacris)"
          },
          "meme_song_info": {},
          "mid": "7072812562194106370",
          "multi_bit_rate_play_info": null,
          "music_release_info": {
            "group_release_date": 1075132800,
            "is_new_release_song": false
          },
          "mute_share": false,
          "offline_desc": "",
          "owner_handle": "",
          "owner_nickname": "",
          "play_url": {
            "height": 720,
            "uri": "https://sf16-ies-music-sg.tiktokcdn.com/obj/tos-alisg-ve-2774/bfdf878344514bbcacec50e0475d3b52",
            "url_list": [
              "https://sf16-ies-music-sg.tiktokcdn.com/obj/tos-alisg-ve-2774/bfdf878344514bbcacec50e0475d3b52"
            ],
            "url_prefix": null,
            "width": 720
          },
          "position": null,
          "prevent_download": false,
          "preview_end_time": 0,
          "preview_start_time": 0,
          "recommend_status": 100,
          "search_highlight": null,
          "shoot_duration": 60,
          "source_platform": 10033,
          "status": 1,
          "strong_beat_url": {
            "height": 720,
            "uri": "https://sf16-ies-music-sg.tiktokcdn.com/obj/tos-alisg-v-2774/okAAgIAuc7nCkm9BIpE1BFbtZAeDrgPDTIfDUG",
            "url_list": [
              "https://sf16-ies-music-sg.tiktokcdn.com/obj/tos-alisg-v-2774/okAAgIAuc7nCkm9BIpE1BFbtZAeDrgPDTIfDUG"
            ],
            "url_prefix": null,
            "width": 720
          },
          "style_value": [
            152
          ],
          "tag_list": null,
          "theme_value": [
            13
          ],
          "title": "Yeah! (feat. Lil Jon & Ludacris)",
          "tt_to_dsp_song_infos": null,
          "uncert_artists": null,
          "user_count": 807750,
          "video_duration": 60
        },
        "aigc_info": {
          "aigc_label_type": 0,
          "created_by_ai": false
        },
        "anchors": [
          {
            "actions": [],
            "anchor_strong": null,
            "component_key": "anchor_poi",
            "description": "Location",
            "extra": "{\"Name\":\"Kansas City\",\"poi_id\":\"22535865206014961\",\"city_code\":\"4393217\",\"region_code\":\"6252001\",\"poi_backend_type\":\"Place and Address,Places,City|19a3a0\",\"poi_info_source\":\"unknown\",\"video_count\":1092703,\"collect_info\":\"{\\\"tt_type_code\\\":\\\"19a3a0\\\",\\\"is_tt_key_category\\\":0,\\\"tt_poi_type_name_level0\\\":\\\"Place and Address\\\",\\\"fake_mining_grade\\\":\\\"5\\\",\\\"tt_poi_type_name_level1\\\":\\\"Place and Address\\\",\\\"is_display_distance\\\":0,\\\"poi_detail_type\\\":\\\"regional\\\",\\\"is_bad_case\\\":0,\\\"has_product\\\":0,\\\"is_product_visible\\\":0,\\\"has_service\\\":0,\\\"is_service_visible\\\":0,\\\"is_shop_url_visible\\\":0,\\\"poi_bizline\\\":\\\"\\\",\\\"local_service_key_category\\\":\\\"Others\\\",\\\"poi_class_name\\\":\\\"Regional\\\",\\\"has_commodity_ref_g1\\\":\\\"0\\\"}\",\"poi_mapkit_collect\":false,\"location\":{\"lat\":\"39.099726\",\"lng\":\"-94.578567\",\"geohash\":\"9yuwrvcurtm1\"},\"fallback_address\":\"Missouri, United States\",\"type_level\":\"1\",\"have_region_discovery\":true,\"fav_cnt\":2949,\"is_tt_key_category\":0,\"is_ls_key_category\":0,\"category_name\":\"City\",\"formatted_address\":\"Missouri, United States\"}",
            "general_type": 1,
            "icon": {
              "height": 720,
              "uri": "tiktok-obj/Map_Pin.png",
              "url_list": [
                "https://p77-sg.tiktokcdn.com/tiktok-obj/Map_Pin.png~tplv-tiktokx-origin.image?biz_tag=anchor.poi&dr=10423&idc=no1a&nonce=26515&ps=933b5bde&refresh_token=1b05ac1dae3762a985a8222edce24881&shcp=d05b14bd&shp=45126217&t=4d5b0474",
                "https://p77-sg.tiktokcdn.com/tiktok-obj/Map_Pin.png~tplv-tiktokx-origin.jpeg?biz_tag=anchor.poi&dr=10423&idc=no1a&nonce=46097&ps=933b5bde&refresh_token=e97bfa44ba68887bf8ff6431b588fa7e&shcp=d05b14bd&shp=45126217&t=4d5b0474"
              ],
              "url_prefix": null,
              "width": 720
            },
            "id": "22535865206014961",
            "keyword": "Kansas City",
            "log_extra": "{\"anchor_id\":\"22535865206014961\",\"anchor_name\":\"Kansas City\",\"anchor_type\":\"poi\",\"is_ad_signal\":\"0\"}",
            "schema": "aweme://poi/detail",
            "thumbnail": {
              "height": 64,
              "uri": "tiktok-obj/poi_thumbnail_3x.png",
              "url_list": [
                "https://p77-sg.tiktokcdn.com/tiktok-obj/poi_thumbnail_3x.png~tplv-tiktokx-origin.image?dr=10423&nonce=72192&refresh_token=e95167b677b457545ba01f65c85b3c85&idc=no1a&ps=933b5bde&shcp=d05b14bd&shp=45126217&t=4d5b0474",
                "https://p77-sg.tiktokcdn.com/tiktok-obj/poi_thumbnail_3x.png~tplv-tiktokx-origin.jpeg?dr=10423&nonce=59635&refresh_token=8939cd1a37a7d33e5e946d8ee48ed06c&idc=no1a&ps=933b5bde&shcp=d05b14bd&shp=45126217&t=4d5b0474"
              ],
              "url_prefix": null,
              "width": 64
            },
            "type": 45
          }
        ],
        "anchors_extras": "",
        "animated_image_info": {
          "effect": 0,
          "type": 0
        },
        "author": {
          "accept_private_policy": false,
          "account_labels": null,
          "ad_cover_url": null,
          "advance_feature_item_order": null,
          "advanced_feature_info": null,
          "authority_status": 0,
          "avatar_168x168": {
            "height": 720,
            "uri": "tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d",
            "url_list": [
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:168:168:q75.webp?dr=9604&idc=no1a&nonce=99229&ps=87d6e48a&refresh_token=dd4a296b31eaef0027111802d615157d&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4",
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:168:168:q75.jpeg?dr=9604&idc=no1a&nonce=3658&ps=87d6e48a&refresh_token=99f998816070b09fd7b32ceea012f360&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4"
            ],
            "url_prefix": null,
            "width": 720
          },
          "avatar_300x300": {
            "height": 720,
            "uri": "tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d",
            "url_list": [
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:300:300:q75.webp?dr=9605&idc=no1a&nonce=8993&ps=87d6e48a&refresh_token=f09bfe350ccfdb7aa0ec0113a173402a&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4",
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:300:300:q75.jpeg?dr=9605&idc=no1a&nonce=91622&ps=87d6e48a&refresh_token=54dbe64fcc96583ee5a6b8a5023e9433&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4"
            ],
            "url_prefix": null,
            "width": 720
          },
          "avatar_larger": {
            "height": 720,
            "uri": "tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d",
            "url_list": [
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:1080:1080:q75.webp?dr=9608&idc=no1a&nonce=25103&ps=87d6e48a&refresh_token=0a9eedb0f8fcb71ecaf4fe147294cc92&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4",
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:1080:1080:q75.jpeg?dr=9608&idc=no1a&nonce=44851&ps=87d6e48a&refresh_token=cdb6e401866b833e830f040e48f18685&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4"
            ],
            "url_prefix": null,
            "width": 720
          },
          "avatar_medium": {
            "height": 720,
            "uri": "tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d",
            "url_list": [
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:720:720:q75.webp?dr=9607&idc=no1a&nonce=90575&ps=87d6e48a&refresh_token=278c1718b10c4c5a8090b1f0d56484de&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4",
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:720:720:q75.jpeg?dr=9607&idc=no1a&nonce=36139&ps=87d6e48a&refresh_token=97e2e38dd8c7eb6a5b2919694ae1d9c1&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4"
            ],
            "url_prefix": null,
            "width": 720
          },
          "avatar_thumb": {
            "height": 720,
            "uri": "tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d",
            "url_list": [
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:100:100:q75.webp?biz_tag=musically_video.video_user_cover&dr=9606&idc=no1a&nonce=77976&ps=87d6e48a&refresh_token=20a3d30293b0cf9782f7b42610a8c1a7&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4",
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d~tplv-tiktokx-cropcenter-q:100:100:q75.jpeg?biz_tag=musically_video.video_user_cover&dr=9606&idc=no1a&nonce=31031&ps=87d6e48a&refresh_token=dac940562526e82131e018a71dcd253a&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4"
            ],
            "url_prefix": null,
            "width": 720
          },
          "avatar_uri": "tos-maliva-avt-0068/43e401b82d50177d5869e4b00ef2505d",
          "aweme_count": 0,
          "bold_fields": null,
          "can_message_follow_status_list": [
            2
          ],
          "can_set_geofencing": null,
          "cha_list": null,
          "comment_filter_status": 0,
          "comment_setting": 0,
          "commerce_user_level": 0,
          "cover_url": null,
          "custom_verify": "",
          "cv_level": "",
          "download_prompt_ts": 0,
          "enabled_filter_all_comments": false,
          "enterprise_verify_reason": "",
          "events": null,
          "fake_data_info": {},
          "fb_expire_time": 0,
          "follow_status": 0,
          "follower_count": 25,
          "follower_status": 0,
          "followers_detail": null,
          "following_count": 63,
          "friends_status": 0,
          "geofencing": null,
          "hide_search": false,
          "homepage_bottom_toast": null,
          "ins_id": "",
          "is_ad_fake": false,
          "is_block": false,
          "is_discipline_member": false,
          "is_mute": 0,
          "is_mute_lives": 0,
          "is_mute_non_story_post": 0,
          "is_mute_story": 0,
          "is_star": false,
          "item_list": null,
          "live_agreement": 0,
          "live_commerce": false,
          "live_verify": 0,
          "mention_status": 1,
          "mutual_relation_avatars": null,
          "name_field": "nickname",
          "need_points": null,
          "need_recommend": 0,
          "nickname": "Peter Griffin, fan",
          "platform_sync_info": null,
          "prevent_download": false,
          "relative_users": null,
          "reply_with_video_flag": 4,
          "room_id": 0,
          "search_highlight": null,
          "search_user_desc": "kansascitychiefsfan5",
          "search_user_name": "Peter Griffin, fan",
          "sec_uid": "MS4wLjABAAAASa520pr6SpRIlq4R8c8HoTu18GmYGiEVv6BDZmBQhSNjcdPIkvvPAOHRk6wwQMF2",
          "secret": 0,
          "shield_comment_notice": 0,
          "shield_digg_notice": 0,
          "shield_edit_field_info": null,
          "shield_follow_notice": 0,
          "short_id": "0",
          "show_image_bubble": false,
          "special_account": {
            "special_account_list": null
          },
          "special_lock": 1,
          "status": 1,
          "stitch_setting": 0,
          "story_status": 0,
          "total_favorited": 0,
          "type_label": null,
          "uid": "7334608148841972782",
          "unique_id": "kansascitychiefsfan5",
          "user_canceled": false,
          "user_mode": 1,
          "user_now_pack_info": {},
          "user_period": 0,
          "user_profile_guide": null,
          "user_rate": 1,
          "user_spark_info": {},
          "user_tags": null,
          "verification_type": 1,
          "verify_info": "",
          "video_icon": {
            "height": 720,
            "uri": "",
            "url_list": [],
            "url_prefix": null,
            "width": 720
          },
          "white_cover_url": null,
          "with_commerce_entry": false,
          "with_shop_entry": false
        },
        "author_user_id": 7334608148841973000,
        "aweme_acl": {
          "download_general": {
            "code": 0,
            "mute": false,
            "show_type": 2,
            "transcode": 3
          },
          "download_mask_panel": {
            "code": 0,
            "mute": false,
            "show_type": 2,
            "transcode": 3
          },
          "platform_list": null,
          "press_action_list": null,
          "share_action_list": null,
          "share_general": {
            "code": 0,
            "mute": false,
            "show_type": 2,
            "transcode": 3
          },
          "share_list_status": 0
        },
        "aweme_id": "7334621391758642478",
        "aweme_type": 0,
        "banners": [
          {
            "key": {
              "component_key": "bottom_banner_search_rs"
            }
          }
        ],
        "behind_the_song_music_ids": null,
        "behind_the_song_video_music_ids": null,
        "bodydance_score": 0,
        "branded_content_accounts": null,
        "cc_template_info": {
          "author_name": "",
          "clip_count": 0,
          "desc": "",
          "duration_milliseconds": 0,
          "related_music_id": "",
          "template_id": ""
        },
        "cha_list": [
          {
            "author": {
              "account_labels": null,
              "ad_cover_url": null,
              "advance_feature_item_order": null,
              "advanced_feature_info": null,
              "bold_fields": null,
              "can_message_follow_status_list": null,
              "can_set_geofencing": null,
              "cha_list": null,
              "cover_url": null,
              "events": null,
              "followers_detail": null,
              "geofencing": null,
              "homepage_bottom_toast": null,
              "item_list": null,
              "mutual_relation_avatars": null,
              "need_points": null,
              "platform_sync_info": null,
              "relative_users": null,
              "search_highlight": null,
              "shield_edit_field_info": null,
              "type_label": null,
              "user_profile_guide": null,
              "user_tags": null,
              "white_cover_url": null
            },
            "banner_list": null,
            "cha_attrs": null,
            "cha_name": "superbowlhalftime",
            "cid": "6297854",
            "collect_stat": 0,
            "connect_music": [],
            "desc": "",
            "extra_attr": {
              "is_live": false
            },
            "hashtag_profile": "",
            "is_challenge": 0,
            "is_commerce": false,
            "is_pgcshow": false,
            "schema": "aweme://aweme/challenge/detail?cid=6297854",
            "search_highlight": null,
            "share_info": {
              "bool_persist": 0,
              "now_invitation_card_image_urls": null,
              "share_desc": "Check out #superbowlhalftime on TikTok!",
              "share_desc_info": "Check out #superbowlhalftime on TikTok!",
              "share_quote": "",
              "share_signature_desc": "",
              "share_signature_url": "",
              "share_title": "It is a becoming a big trend on TikTok now! Click here: superbowlhalftime",
              "share_title_myself": "",
              "share_title_other": "",
              "share_url": "https://www.tiktok.com/tag/superbowlhalftime?_r=1&name=superbowlhalftime&u_code=ecl95fe242hb0g&_d=ecl9369b611jfk&share_challenge_id=6297854&sharer_language=en&source=h5_m"
            },
            "show_items": null,
            "sub_type": 0,
            "type": 1,
            "use_count": 0,
            "user_count": 0,
            "view_count": 0
          }
        ],
        "challenge_position": null,
        "cmt_swt": false,
        "collect_stat": 0,
        "comment_config": {
          "comment_panel_show_tab_config": null,
          "emoji_recommend_list": null,
          "long_press_recommend_list": null,
          "preload": {
            "preds": "{\"item_post_comment\":0.00015784323010386084}"
          },
          "quick_comment": {
            "enabled": true
          },
          "quick_comment_emoji_recommend_list": null
        },
        "comment_topbar_info": null,
        "commerce_config_data": null,
        "commerce_info": {
          "adv_promotable": false,
          "auction_ad_invited": false,
          "branded_content_type": 0,
          "with_comment_filter_words": false
        },
        "content_desc": "",
        "content_desc_extra": [],
        "content_model": {
          "custom_biz": {
            "aweme_trace": "2025012420462477D7BDF0C82176619A80"
          },
          "standard_biz": {
            "e_commerce": {
              "ttec_content_tag": {
                "recommendation_tag_consumer_str": "",
                "recommendation_tag_creator_str": ""
              }
            },
            "tts_voice_info": {
              "tts_voice_attr": "[]",
              "tts_voice_reuse_params": ""
            },
            "vc_filter_info": {
              "vc_filter_attr": "[]"
            }
          }
        },
        "content_original_type": 1,
        "content_size_type": 1,
        "content_type": "video",
        "cover_labels": null,
        "create_time": 1707724682,
        "creation_info": {
          "creation_used_functions": [
            "high_quality_upload",
            "filter",
            "select_music",
            "editor_pro"
          ]
        },
        "desc": "The most insane Super Bowl ever ‼️‼️‼️‼️#superbowlhalftime #SuperBowl #traviskelce #traviskelce #kansascitychiefs ",
        "desc_language": "en",
        "disable_search_trending_bar": false,
        "distance": "",
        "distribute_type": 2,
        "follow_up_item_id_groups": "",
        "follow_up_publish_from_id": -1,
        "geofencing": null,
        "geofencing_regions": null,
        "green_screen_materials": null,
        "group_id": "7334560561012673822",
        "group_id_list": {
          "GroupdIdList0": [
            7334560561012674000
          ],
          "GroupdIdList1": [
            7334560561012674000
          ]
        },
        "has_danmaku": false,
        "has_promote_entry": 2,
        "has_vs_entry": false,
        "have_dashboard": false,
        "hybrid_label": null,
        "image_infos": null,
        "interact_permission": {
          "allow_adding_as_post": {
            "status": 0
          },
          "allow_adding_to_story": 0,
          "allow_create_sticker": {
            "status": 0
          },
          "allow_story_switch_to_post": {},
          "duet": 0,
          "duet_privacy_setting": 0,
          "stitch": 0,
          "stitch_privacy_setting": 0,
          "upvote": 0
        },
        "interaction_stickers": null,
        "is_ads": false,
        "is_description_translatable": true,
        "is_hash_tag": 1,
        "is_nff_or_nr": false,
        "is_on_this_day": 0,
        "is_pgcshow": false,
        "is_preview": 0,
        "is_relieve": false,
        "is_text_sticker_translatable": false,
        "is_title_translatable": false,
        "is_top": 0,
        "is_vr": false,
        "item_comment_settings": 0,
        "item_duet": 0,
        "item_react": 0,
        "item_stitch": 0,
        "label_top": {
          "height": 720,
          "uri": "tiktok-obj/1598708589477025.PNG",
          "url_list": [
            "https://p77-sg.tiktokcdn.com/tiktok-obj/1598708589477025.PNG~tplv-tiktokx-origin.image?dr=10423&nonce=70891&refresh_token=d2007fa03df39cb52de015bd98b507ba&idc=no1a&ps=933b5bde&shcp=d05b14bd&shp=45126217&t=4d5b0474",
            "https://p77-sg.tiktokcdn.com/tiktok-obj/1598708589477025.PNG~tplv-tiktokx-origin.jpeg?dr=10423&nonce=43923&refresh_token=41c227e5edf173742615b04d6867a6d2&idc=no1a&ps=933b5bde&shcp=d05b14bd&shp=45126217&t=4d5b0474"
          ],
          "url_prefix": null,
          "width": 720
        },
        "label_top_text": null,
        "long_video": null,
        "main_arch_common": "",
        "mask_infos": [],
        "misc_info": "{}",
        "muf_comment_info_v2": null,
        "music": {
          "album": "Yeah! (feat. Lil Jon & Ludacris)",
          "allow_offline_music_to_detail_page": false,
          "artists": [
            {
              "avatar": {
                "uri": "tos-maliva-avt-0068/122719f01f36ed8578e8299237f9cdce",
                "url_list": [
                  "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/122719f01f36ed8578e8299237f9cdce~tplv-tiktokx-cropcenter-q:168:168:q75.webp?dr=9604&idc=no1a&nonce=55741&ps=87d6e48a&refresh_token=da514b973402e5a0d5fcd41636b64929&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4",
                  "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/122719f01f36ed8578e8299237f9cdce~tplv-tiktokx-cropcenter-q:168:168:q75.jpeg?dr=9604&idc=no1a&nonce=74470&ps=87d6e48a&refresh_token=98917cc387db6d79e33774c79a5da3ca&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4"
                ],
                "url_prefix": null
              },
              "enter_type": 2,
              "follow_status": 0,
              "follower_status": 0,
              "handle": "usher",
              "is_block": false,
              "is_blocked": false,
              "is_private_account": false,
              "is_verified": true,
              "is_visible": false,
              "nick_name": "Usher Raymond",
              "sec_uid": "MS4wLjABAAAA2qFUyY878XlTp6vlLi2LWROamZKwkQfqRLMHo8O0UizXpnO-yXE2qR7QZKRCJJy_",
              "status": 1,
              "uid": "6779798771846431749"
            },
            {
              "avatar": {
                "uri": "tos-maliva-avt-0068/7316288117144485894",
                "url_list": [
                  "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/7316288117144485894~tplv-tiktokx-cropcenter-q:168:168:q75.webp?dr=9604&idc=no1a&nonce=79543&ps=87d6e48a&refresh_token=182adee6003a62a55372347a693e4934&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4",
                  "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/7316288117144485894~tplv-tiktokx-cropcenter-q:168:168:q75.jpeg?dr=9604&idc=no1a&nonce=57038&ps=87d6e48a&refresh_token=83f0ce8a0342e43b0c79dc733d8e2cd5&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4"
                ],
                "url_prefix": null
              },
              "enter_type": 2,
              "follow_status": 0,
              "follower_status": 0,
              "handle": "liljon",
              "is_block": false,
              "is_blocked": false,
              "is_private_account": false,
              "is_verified": true,
              "is_visible": false,
              "nick_name": "Lil Jon",
              "sec_uid": "MS4wLjABAAAAIijhe2POnJU-xRffTq5KyI2Q8tOHEPOKD1uNFL3IvjzIvuC5Lv401YQEgsTY_Fvi",
              "status": 1,
              "uid": "6533676606852961280"
            }
          ],
          "audition_duration": 60,
          "author": "Usher",
          "author_deleted": false,
          "author_position": null,
          "avatar_medium": {
            "height": 720,
            "uri": "tos-maliva-avt-0068/122719f01f36ed8578e8299237f9cdce",
            "url_list": [
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/122719f01f36ed8578e8299237f9cdce~tplv-tiktokx-cropcenter-q:720:720:q75.webp?dr=9607&idc=no1a&nonce=97370&ps=87d6e48a&refresh_token=b9485e3d56e65cf76146fa9d97ee4e9d&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4",
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/122719f01f36ed8578e8299237f9cdce~tplv-tiktokx-cropcenter-q:720:720:q75.jpeg?dr=9607&idc=no1a&nonce=51046&ps=87d6e48a&refresh_token=eb28e677637b39ebdd93156f0e403489&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4"
            ],
            "url_prefix": null,
            "width": 720
          },
          "avatar_thumb": {
            "height": 720,
            "uri": "tos-maliva-avt-0068/122719f01f36ed8578e8299237f9cdce",
            "url_list": [
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/122719f01f36ed8578e8299237f9cdce~tplv-tiktokx-cropcenter-q:100:100:q75.webp?dr=9606&idc=no1a&nonce=56894&ps=87d6e48a&refresh_token=d8e3842c35adc58c7b21aa4de0716e52&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4",
              "https://p16-amd-va.tiktokcdn.com/tos-maliva-avt-0068/122719f01f36ed8578e8299237f9cdce~tplv-tiktokx-cropcenter-q:100:100:q75.jpeg?dr=9606&idc=no1a&nonce=54893&ps=87d6e48a&refresh_token=727988347c37754415e9911aa4c56e92&s=SEARCH&sc=avatar&shcp=c1333099&shp=45126217&t=223449c4"
            ],
            "url_prefix": null,
            "width": 720
          },
          "binded_challenge_id": 0,
          "can_be_stitched": false,
          "can_not_reuse": false,
          "collect_stat": 0,
          "commercial_right_type": 3,
          "cover_large": {
            "height": 720,
            "uri": "tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b",
            "url_list": [
              "https://p16-sg.tiktokcdn.com/aweme/720x720/tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b.jpeg"
            ],
            "url_prefix": null,
            "width": 720
          },
          "cover_medium": {
            "height": 720,
            "uri": "tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b",
            "url_list": [
              "https://p16-sg.tiktokcdn.com/aweme/200x200/tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b.jpeg"
            ],
            "url_prefix": null,
            "width": 720
          },
          "cover_thumb": {
            "height": 720,
            "uri": "tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b",
            "url_list": [
              "https://p16-sg.tiktokcdn.com/aweme/100x100/tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b.jpeg"
            ],
            "url_prefix": null,
            "width": 720
          },
          "create_time": 1646767514,
          "dmv_auto_show": false,
          "duration": 60,
          "duration_high_precision": {
            "audition_duration_precision": 60,
            "duration_precision": 60,
            "shoot_duration_precision": 60,
            "video_duration_precision": 60
          },
          "external_song_info": [],
          "extra": "{\"amplitude_peak\":1.1201035,\"beats\":{\"audio_effect_onset\":\"https://sf77-ies-music-sg.tiktokcdn.com/obj/tos-alisg-v-2774/439648c9db134eeea4626f1441f4fd85\",\"beats_tracker\":\"https://sf16-ies-music-sg.tiktokcdn.com/obj/tos-alisg-v-2774/2f63338020c14f2ead895158393d1688\",\"energy_trace\":\"https://sf16-ies-music-sg.tiktokcdn.com/obj/tos-alisg-v-2774/fc7e1ef3c7ab4fc997b8f5e657f86cab\",\"merged_beats\":\"https://sf77-ies-music-sg.tiktokcdn.com/obj/tos-alisg-v-2774/a3f0715ab5304acdb93e0e44c2911884\"},\"can_read\":true,\"can_reuse\":true,\"erase_type\":0,\"erase_uid\":0,\"from_user_id\":7339876632230134816,\"full_song_beat_info\":{},\"full_song_beats\":{},\"has_edited\":0,\"is_batch_take_down_music\":false,\"is_ugc_mapping\":false,\"is_used\":0,\"loudness_lufs\":-9.173245,\"music_vid\":\"v10ad6g50000cc1h183c77u9c47ldr4g\",\"owner_id\":0,\"resource_status\":0,\"review_unshelve_reason\":0,\"reviewed\":1,\"schedule_search_time\":0}",
          "has_commerce_right": false,
          "id": 7072812562194106000,
          "id_str": "7072812562194106370",
          "is_audio_url_with_cookie": false,
          "is_author_artist": true,
          "is_commerce_music": true,
          "is_matched_metadata": false,
          "is_original": false,
          "is_original_sound": false,
          "is_pgc": true,
          "is_play_music": true,
          "is_shooting_allow": true,
          "language": "English",
          "log_extra": "{\"meta_song_matched_type\":\"pgc\",\"ttm_matched_type\":\"\",\"ttm_track_id\":\"\",\"matched_meta_song_id\":\"\",\"vid\":\"\",\"owner_id\":\"\"}",
          "lyric_short_position": null,
          "matched_song": {
            "author": "Usher",
            "chorus_info": {
              "duration_ms": 27455,
              "start_ms": 56064
            },
            "cover_medium": {
              "height": 720,
              "uri": "tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b",
              "url_list": [
                "https://p16-sg.tiktokcdn.com/aweme/200x200/tos-alisg-v-2774/385280e9815e440caa58a11fbeb04b6b.jpeg"
              ],
              "url_prefix": null,
              "width": 720
            },
            "full_duration": 250420,
            "h5_url": "",
            "id": "7072812557722978305",
            "performers": null,
            "title": "Yeah! (feat. Lil Jon & Ludacris)"
          },
          "meme_song_info": {},
          "mid": "7072812562194106370",
          "multi_bit_rate_play_info": null,
          "music_release_info": {
            "group_release_date": 1075132800,
            "is_new_release_song": false
          },
          "mute_share": false,
          "offline_desc": "",
          "owner_handle": "",
          "owner_nickname": "",
          "play_url": {
            "height": 720,
            "uri": "https://sf16-ies-music-sg.tiktokcdn.com/obj/tos-alisg-ve-2774/bfdf878344514bbcacec50e0475d3b52",
            "url_list": [
              "https://sf16-ies-music-sg.tiktokcdn.com/obj/tos-alisg-ve-2774/bfdf878344514bbcacec50e0475d3b52"
            ],
            "url_prefix": null,
            "width": 720
          },
          "position": null,
          "prevent_download": false,
          "preview_end_time": 0,
          "preview_start_time": 0,
          "recommend_status": 100,
          "search_highlight": null,
          "shoot_duration": 60,
          "source_platform": 10033,
          "status": 1,
          "strong_beat_url": {
            "height": 720,
            "uri": "https://sf16-ies-music-sg.tiktokcdn.com/obj/tos-alisg-v-2774/okAAgIAuc7nCkm9BIpE1BFbtZAeDrgPDTIfDUG",
            "url_list": [
              "https://sf16-ies-music-sg.tiktokcdn.com/obj/tos-alisg-v-2774/okAAgIAuc7nCkm9BIpE1BFbtZAeDrgPDTIfDUG"
            ],
            "url_prefix": null,
            "width": 720
          },
          "style_value": [
            152
          ],
          "tag_list": null,
          "theme_value": [
            13
          ],
          "title": "Yeah! (feat. Lil Jon & Ludacris)",
          "tt_to_dsp_song_infos": null,
          "uncert_artists": null,
          "user_count": 807750,
          "video_duration": 60
        },
        "music_begin_time_in_ms": 0,
        "music_end_time_in_ms": 83833,
        "music_selected_from": "edit_page_recommend",
        "music_title_style": 0,
        "music_volume": "10.550460",
        "need_trim_step": false,
        "need_vs_entry": false,
        "nickname_position": null,
        "no_selected_music": false,
        "operator_boost_info": null,
        "origin_comment_ids": null,
        "origin_volume": "100.000000",
        "original_client_text": {
          "markup_text": "The most insane Super Bowl ever ‼️‼️‼️‼️<h id=\"1882\">#superbowlhalftime</h> <h id=\"1889\">#SuperBowl</h> <h id=\"1902\">#traviskelce</h> <h id=\"1921\">#traviskelce</h> <h id=\"1946\">#kansascitychiefs</h> ",
          "text_extra": [
            {
              "hashtag_id": "6297854",
              "hashtag_name": "superbowlhalftime",
              "is_commerce": false,
              "sec_uid": "",
              "tag_id": "1882",
              "type": 1,
              "user_id": ""
            },
            {
              "hashtag_id": "9484",
              "hashtag_name": "superbowl",
              "is_commerce": false,
              "sec_uid": "",
              "tag_id": "1889",
              "type": 1,
              "user_id": ""
            },
            {
              "hashtag_id": "16548509",
              "hashtag_name": "traviskelce",
              "is_commerce": false,
              "sec_uid": "",
              "tag_id": "1902",
              "type": 1,
              "user_id": ""
            },
            {
              "hashtag_id": "16548509",
              "hashtag_name": "traviskelce",
              "is_commerce": false,
              "sec_uid": "",
              "tag_id": "1921",
              "type": 1,
              "user_id": ""
            },
            {
              "hashtag_id": "1461141",
              "hashtag_name": "kansascitychiefs",
              "is_commerce": false,
              "sec_uid": "",
              "tag_id": "1946",
              "type": 1,
              "user_id": ""
            }
          ]
        },
        "picked_users": [],
        "playlist_blocked": false,
        "poi_data": {
          "address_info": {
            "address": "Missouri, United States",
            "city_code": "4393217",
            "city_name": "",
            "geohash": "9yuwrvcurtm1",
            "l0_geoname_id": "6252001",
            "lat": "39.099726",
            "lng": "-94.578567",
            "region_code": "6252001"
          },
          "collect_info": "{\"fake_mining_grade\":\"5\",\"has_commodity_ref_g1\":\"0\",\"has_product\":0,\"has_service\":0,\"is_author_country_compliance\":0,\"is_bad_case\":0,\"is_display_distance\":0,\"is_influencer_compliance\":1,\"is_influencer_compliance_including_control_group\":0,\"is_marketing_info_compliance\":1,\"is_product_visible\":0,\"is_service_visible\":0,\"is_shop_url_visible\":0,\"is_song_compliance\":0,\"is_tt_key_category\":0,\"local_service_key_category\":\"Others\",\"poi_bizline\":\"\",\"poi_class_name\":\"Regional\",\"poi_detail_type\":\"regional\",\"tt_poi_type_name_level0\":\"Place and Address\",\"tt_poi_type_name_level1\":\"Place and Address\",\"tt_type_code\":\"19a3a0\"}",
          "comment_anchor": {
            "has_sub_arrow": false,
            "hide_list": null,
            "sub_tag_exp_time": 0,
            "sub_tag_exp_type": 0,
            "sub_tags": [
              {
                "name": "124.8M likes on posts of this place",
                "priority": 1,
                "type": 13
              }
            ],
            "suffix": "",
            "track_info": "{\"poi_info\":\"xx_people_like\"}"
          },
          "icon": {
            "height": 0,
            "uri": "tiktok-obj/Map_Pin.png",
            "url_list": [
              "https://p77-sg.tiktokcdn.com/tiktok-obj/Map_Pin.png~tplv-tiktokx-origin.image?dr=10423&nonce=57421&refresh_token=3172d0e3199efb84411d568ca02835db&idc=no1a&ps=933b5bde&shcp=d05b14bd&shp=45126217&t=4d5b0474",
              "https://p77-sg.tiktokcdn.com/tiktok-obj/Map_Pin.png~tplv-tiktokx-origin.jpeg?dr=10423&nonce=1258&refresh_token=9b51c684a1ab229d6f68404019e4597b&idc=no1a&ps=933b5bde&shcp=d05b14bd&shp=45126217&t=4d5b0474"
            ],
            "url_prefix": null,
            "width": 0
          },
          "info_source": "unknown",
          "poi_id": "22535865206014961",
          "poi_mapkit_collect": false,
          "poi_name": "Kansas City",
          "poi_review_config": {},
          "poi_type": "Place and Address,Places,City|19a3a0",
          "thumbnail": {
            "height": 64,
            "uri": "tiktok-obj/poi_thumbnail_3x.png",
            "url_list": [
              "https://p77-sg.tiktokcdn.com/tiktok-obj/poi_thumbnail_3x.png~tplv-tiktokx-origin.image?dr=10423&nonce=26629&refresh_token=5db7f73e14d929f7c1af8d31eb76ff51&idc=no1a&ps=933b5bde&shcp=d05b14bd&shp=45126217&t=4d5b0474",
              "https://p77-sg.tiktokcdn.com/tiktok-obj/poi_thumbnail_3x.png~tplv-tiktokx-origin.jpeg?dr=10423&nonce=28883&refresh_token=a8fd7a7bcb195a365b60ead96cd075d1&idc=no1a&ps=933b5bde&shcp=d05b14bd&shp=45126217&t=4d5b0474"
            ],
            "url_prefix": null,
            "width": 64
          },
          "type_level": "1",
          "video_anchor": {
            "has_sub_arrow": false,
            "hide_list": null,
            "sub_tag_exp_time": 3000,
            "sub_tag_exp_type": 2,
            "sub_tags": [
              {
                "name": "136.2K people posted about this place",
                "priority": 1,
                "type": 2
              }
            ],
            "suffix": "",
            "track_info": "{\"poi_info\":\"xx_people_visit\"}"
          },
          "video_count": 1092703
        },
        "poi_re_tag_signal": 0,
        "position": null,
        "prevent_download": false,
        "products_info": null,
        "promote_capcut_toggle": 0,
        "promote_icon_text": "Promote",
        "promote_toast": "Can’t promote due to audio copyright issue",
        "promote_toast_key": "reason_cannot_promote_music",
        "question_list": null,
        "quick_reply_emojis": [
          "😍",
          "😂",
          "😳"
        ],
        "rate": 12,
        "reference_tts_voice_ids": null,
        "reference_voice_filter_ids": null,
        "region": "US",
        "risk_infos": {
          "content": "",
          "risk_sink": false,
          "type": 0,
          "vote": false,
          "warn": false
        },
        "search_desc": "The most insane Super Bowl ever !!️!!️!!️!!️ #superbowlhalftime INSANE ENDING to the 2024 Super Bowl",
        "search_highlight": [],
        "share_info": {
          "bool_persist": 0,
          "now_invitation_card_image_urls": null,
          "share_desc": "Check out Peter Griffin, fan's video! #TikTok",
          "share_desc_info": "TikTok: Make Every Second CountCheck out Peter Griffin, fan’s video! #TikTok > ",
          "share_link_desc": "",
          "share_quote": "",
          "share_signature_desc": "",
          "share_signature_url": "",
          "share_title": "Check out Peter Griffin, fan’s video! #TikTok > ",
          "share_title_myself": "",
          "share_title_other": "",
          "share_url": "https://www.tiktok.com/@kansascitychiefsfan5/video/7334621391758642478?_r=1&u_code=ecl95fe242hb0g&preview_pb=0&sharer_language=en&_d=ecl9369b611jfk&share_item_id=7334621391758642478&source=h5_m",
          "whatsapp_desc": "Download TikTok and watch more fun videos:"
        },
        "share_url": "https://www.tiktok.com/@kansascitychiefsfan5/video/7334621391758642478?_r=1&u_code=ecl95fe242hb0g&preview_pb=0&sharer_language=en&_d=ecl9369b611jfk&share_item_id=7334621391758642478&source=h5_m",
        "shoot_tab_name": "photo",
        "social_interaction_blob": {
          "auxiliary_model_content": "ChIKBPCfmI0KBPCfmIIKBPCfmLM="
        },
        "solaria_profile": {
          "profile": "{\"play_time_prob_dist\":\"[800,0.4459,7720.6125]\"}"
        },
        "sort_label": "",
        "standard_component_info": {
          "banner_enabled": false
        },
        "statistics": {
          "aweme_id": "7334621391758642478",
          "collect_count": 30,
          "comment_count": 5,
          "digg_count": 355,
          "download_count": 16,
          "forward_count": 0,
          "lose_comment_count": 0,
          "lose_count": 0,
          "play_count": 31677,
          "repost_count": 0,
          "share_count": 22,
          "whatsapp_share_count": 6
        },
        "status": {
          "allow_comment": true,
          "allow_share": true,
          "aweme_id": "7334621391758642478",
          "download_status": 0,
          "in_reviewing": false,
          "is_delete": false,
          "is_prohibited": false,
          "private_status": 0,
          "review_result": {
            "review_status": 0
          },
          "reviewed": 0,
          "self_see": false
        },
        "suggest_words": {
          "suggest_words": [
            {
              "hint_text": "Search · ",
              "qrec_virtual_enable": "",
              "scene": "feed_bar",
              "words": [
                {
                  "penetrate_info": "{\"lvl1_category_id\":\"\",\"is_time_sensitive\":\"0\",\"generate_time\":\"0\",\"hot_level\":\"0\",\"word_type_list\":\"\",\"predict_ctr_score\":0.004017964625750429,\"is_ramandan_promotion\":\"\",\"ecom_trigger_info\":\"\",\"lvl3_cate_list\":\"\",\"ecom_intent\":\"0\",\"ecom_trigger_info_map\":\"\"}",
                  "word": "2025 super bowl",
                  "word_id": "2257940335911144874",
                  "word_record": {
                    "words_lang": "en"
                  }
                }
              ]
            }
          ]
        },
        "support_danmaku": false,
        "text_extra": [
          {
            "end": 58,
            "hashtag_id": "6297854",
            "hashtag_name": "superbowlhalftime",
            "is_commerce": false,
            "sec_uid": "",
            "start": 40,
            "type": 1,
            "user_id": ""
          },
          {
            "end": 69,
            "hashtag_id": "9484",
            "hashtag_name": "superbowl",
            "is_commerce": false,
            "sec_uid": "",
            "start": 59,
            "type": 1,
            "user_id": ""
          },
          {
            "end": 82,
            "hashtag_id": "16548509",
            "hashtag_name": "traviskelce",
            "is_commerce": false,
            "sec_uid": "",
            "start": 70,
            "type": 1,
            "user_id": ""
          },
          {
            "end": 95,
            "hashtag_id": "16548509",
            "hashtag_name": "traviskelce",
            "is_commerce": false,
            "sec_uid": "",
            "start": 83,
            "type": 1,
            "user_id": ""
          },
          {
            "end": 113,
            "hashtag_id": "1461141",
            "hashtag_name": "kansascitychiefs",
            "is_commerce": false,
            "sec_uid": "",
            "start": 96,
            "type": 1,
            "user_id": ""
          }
        ],
        "text_sticker_major_lang": "un",
        "title_language": "un",
        "ttec_suggest_words": {
          "ttec_suggest_words": null
        },
        "tts_voice_ids": null,
        "ttt_product_recall_type": -2,
        "uniqid_position": null,
        "upvote_info": {
          "friends_recall_info": "{}",
          "repost_initiate_score": 0,
          "user_upvoted": false
        },
        "upvote_preload": {
          "need_pull_upvote_info": false
        },
        "used_full_song": false,
        "user_digged": 0,
        "video": {
          "CoverTsp": 0,
          "ai_dynamic_cover": {
            "uri": "tos-useast5-p-0068-tx/622ea84b20024465881ab5b4182ab175_1707724683",
            "url_list": [
              "https://p16-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/622ea84b20024465881ab5b4182ab175_1707724683~tplv-tiktokx-origin.image?dr=9229&nonce=29182&refresh_token=8d1c81cf3a7d606d3614129b133f4c83&x-expires=1737835200&x-signature=tw8kwrfRyLIXYTC2pU%2F%2BgHeu4dc%3D&biz_tag=tt_video&idc=no1a&ps=4f5296ae&s=SEARCH&sc=cover&shcp=c1333099&shp=d05b14bd&t=bacd0480",
              "https://p19-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/622ea84b20024465881ab5b4182ab175_1707724683~tplv-tiktokx-origin.image?dr=9229&nonce=64033&refresh_token=ef9f8f28930a7362cf241df5ed7bfbb9&x-expires=1737835200&x-signature=mZEntA%2BnR8a4fzV8dEbv%2Fh30S84%3D&biz_tag=tt_video&idc=no1a&ps=4f5296ae&s=SEARCH&sc=cover&shcp=c1333099&shp=d05b14bd&t=bacd0480"
            ],
            "url_prefix": null
          },
          "ai_dynamic_cover_bak": {
            "uri": "tos-useast5-p-0068-tx/622ea84b20024465881ab5b4182ab175_1707724683",
            "url_list": [
              "https://p16-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/622ea84b20024465881ab5b4182ab175_1707724683~tplv-tiktokx-origin.image?dr=9229&nonce=29182&refresh_token=8d1c81cf3a7d606d3614129b133f4c83&x-expires=1737835200&x-signature=tw8kwrfRyLIXYTC2pU%2F%2BgHeu4dc%3D&biz_tag=tt_video&idc=no1a&ps=4f5296ae&s=SEARCH&sc=cover&shcp=c1333099&shp=d05b14bd&t=bacd0480",
              "https://p19-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/622ea84b20024465881ab5b4182ab175_1707724683~tplv-tiktokx-origin.image?dr=9229&nonce=64033&refresh_token=ef9f8f28930a7362cf241df5ed7bfbb9&x-expires=1737835200&x-signature=mZEntA%2BnR8a4fzV8dEbv%2Fh30S84%3D&biz_tag=tt_video&idc=no1a&ps=4f5296ae&s=SEARCH&sc=cover&shcp=c1333099&shp=d05b14bd&t=bacd0480"
            ],
            "url_prefix": null
          },
          "animated_cover": {
            "uri": "tos-useast5-p-0068-tx/622ea84b20024465881ab5b4182ab175_1707724683",
            "url_list": [
              "https://p16-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/622ea84b20024465881ab5b4182ab175_1707724683~tplv-tiktokx-origin.image?dr=9229&nonce=29182&refresh_token=8d1c81cf3a7d606d3614129b133f4c83&x-expires=1737835200&x-signature=tw8kwrfRyLIXYTC2pU%2F%2BgHeu4dc%3D&biz_tag=tt_video&idc=no1a&ps=4f5296ae&s=SEARCH&sc=cover&shcp=c1333099&shp=d05b14bd&t=bacd0480",
              "https://p19-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/622ea84b20024465881ab5b4182ab175_1707724683~tplv-tiktokx-origin.image?dr=9229&nonce=64033&refresh_token=ef9f8f28930a7362cf241df5ed7bfbb9&x-expires=1737835200&x-signature=mZEntA%2BnR8a4fzV8dEbv%2Fh30S84%3D&biz_tag=tt_video&idc=no1a&ps=4f5296ae&s=SEARCH&sc=cover&shcp=c1333099&shp=d05b14bd&t=bacd0480"
            ],
            "url_prefix": null
          },
          "big_thumbs": [
            {
              "duration": 83.850517,
              "fext": "jpeg",
              "img_num": 84,
              "img_uris": [
                "tos-maliva-p-0068c799-us/4c39bb0f2b9746af94d6332d811526b4_1707724687",
                "tos-maliva-p-0068c799-us/2fe2fcaabba740fca0e433171a855886_1707724687",
                "tos-maliva-p-0068c799-us/01bcc6b5d92e4022878acb841aeec7c4_1707724687",
                "tos-maliva-p-0068c799-us/093c001b03984e8589e68bdf3c7e7f9c_1707724687"
              ],
              "img_url": "",
              "img_urls": [
                "https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068c799-us/4c39bb0f2b9746af94d6332d811526b4_1707724687~tplv-noop.image?x-expires=1737838067&x-signature=fBSE52mfMJeyKv5iRfmVERfvhHc%3D",
                "https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068c799-us/2fe2fcaabba740fca0e433171a855886_1707724687~tplv-noop.image?x-expires=1737838067&x-signature=OfTep4MOeDEvS5ucfSeb%2BE207PY%3D",
                "https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068c799-us/01bcc6b5d92e4022878acb841aeec7c4_1707724687~tplv-noop.image?x-expires=1737838067&x-signature=cm2b9iCru0x46tSpeUF%2BCuKq7w4%3D",
                "https://p16-sign-va.tiktokcdn.com/tos-maliva-p-0068c799-us/093c001b03984e8589e68bdf3c7e7f9c_1707724687~tplv-noop.image?x-expires=1737838067&x-signature=n1teyiv2Myh1ZR2ymNuUn1mQRlA%3D"
              ],
              "img_x_len": 5,
              "img_x_size": 136,
              "img_y_len": 5,
              "img_y_size": 240,
              "interval": 1,
              "uri": ""
            }
          ],
          "bit_rate": [
            {
              "HDR_bit": "",
              "HDR_type": "",
              "bit_rate": 720429,
              "dub_infos": null,
              "fps": 29,
              "gear_name": "adapt_540_1",
              "is_bytevc1": 1,
              "play_addr": {
                "data_size": 7551089,
                "file_cs": "c:0-70516-ba01",
                "file_hash": "097f81f42691eb4aa88a8c82b6a4fd17",
                "height": 1024,
                "uri": "v12044gd0000cn4suufog65pkilpo7og",
                "url_key": "v12044gd0000cn4suufog65pkilpo7og_bytevc1_540p_720429",
                "url_list": [
                  "https://v45.tiktokcdn-eu.com/2d6f54b76b0410de1fc746eb33927f56/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/ooIE2ilpcBHHDuB9EfpIMSQgiAwKxy58c5eARn/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=1406&bt=703&cs=2&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=11&rc=Ojg8OzpmaDw0NjQ8PDs2Z0BpajpzbHM5cnh2cTMzZzczNEBfYy0zMDU0NjQxXjI2Li5eYSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00095000",
                  "https://v15m.tiktokcdn-eu.com/be0584bbe52b4f0e09977622b389fb65/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/ooIE2ilpcBHHDuB9EfpIMSQgiAwKxy58c5eARn/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=1406&bt=703&cs=2&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=11&rc=Ojg8OzpmaDw0NjQ8PDs2Z0BpajpzbHM5cnh2cTMzZzczNEBfYy0zMDU0NjQxXjI2Li5eYSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00090000",
                  "https://api16-normal-no1a.tiktokv.eu/aweme/v1/play/?faid=1233&file_id=ad13189959a14371997e8c376809f5b7&is_play_url=1&item_id=7334621391758642478&line=0&signaturev3=dmlkZW9faWQ7ZmlsZV9pZDtpdGVtX2lkLmM5ZjlkNmE0YTljZTgzN2QzOTlmMmNlNGNlMGFlZjc3&source=SEARCH&video_id=v12044gd0000cn4suufog65pkilpo7og"
                ],
                "url_prefix": null,
                "width": 576
              },
              "quality_type": 28,
              "video_extra": "{\"PktOffsetMap\":\"[{\\\"time\\\": 1, \\\"offset\\\": 190572}, {\\\"time\\\": 2, \\\"offset\\\": 257800}, {\\\"time\\\": 3, \\\"offset\\\": 322211}, {\\\"time\\\": 4, \\\"offset\\\": 405272}, {\\\"time\\\": 5, \\\"offset\\\": 500430}, {\\\"time\\\": 10, \\\"offset\\\": 893592}]\",\"mvmaf\":\"{\\\"v2.0\\\": {\\\"ori\\\": {\\\"v1080\\\": 85.745, \\\"v960\\\": 87.884, \\\"v864\\\": 90.711, \\\"v720\\\": 93.151}, \\\"srv1\\\": {\\\"v1080\\\": 97.048, \\\"v960\\\": 97.362, \\\"v864\\\": 98.857, \\\"v720\\\": 99.188}}}\",\"volume_info_json\":\"\",\"transcode_feature_id\":\"d2855c583ab7dd2f69b34dc4f402cebc\"}"
            },
            {
              "HDR_bit": "",
              "HDR_type": "",
              "bit_rate": 582751,
              "dub_infos": null,
              "fps": 29,
              "gear_name": "lower_540_1",
              "is_bytevc1": 1,
              "play_addr": {
                "data_size": 6108039,
                "file_cs": "c:0-70516-0ab9",
                "file_hash": "9fba41673680a583465c8742301e562b",
                "height": 1024,
                "uri": "v12044gd0000cn4suufog65pkilpo7og",
                "url_key": "v12044gd0000cn4suufog65pkilpo7og_bytevc1_540p_582751",
                "url_list": [
                  "https://v45.tiktokcdn-eu.com/70cc3319368ae61eeb75070cf21e322e/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/oEplk3euFA05QR6ogIixywSB8fKHcmciDEBx2E/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=1138&bt=569&cs=2&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=4&rc=aWU5M2Q7ZDc7OmkzNjZoaUBpajpzbHM5cnh2cTMzZzczNEBiMWI2Yi41NWIxY2JjNGNiYSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00095000",
                  "https://v15m.tiktokcdn-eu.com/be98a7b35edf45fa8f421741d1557ae0/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/oEplk3euFA05QR6ogIixywSB8fKHcmciDEBx2E/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=1138&bt=569&cs=2&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=4&rc=aWU5M2Q7ZDc7OmkzNjZoaUBpajpzbHM5cnh2cTMzZzczNEBiMWI2Yi41NWIxY2JjNGNiYSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00090000",
                  "https://api16-normal-no1a.tiktokv.eu/aweme/v1/play/?faid=1233&file_id=effe73f3e0ff47e8848a18ea90e64bef&is_play_url=1&item_id=7334621391758642478&line=0&signaturev3=dmlkZW9faWQ7ZmlsZV9pZDtpdGVtX2lkLjg0MmYyZDIxYzllNmQ1NzBmNGIzN2IxNTFhMmMyMjVl&source=SEARCH&video_id=v12044gd0000cn4suufog65pkilpo7og"
                ],
                "url_prefix": null,
                "width": 576
              },
              "quality_type": 24,
              "video_extra": "{\"PktOffsetMap\":\"[{\\\"time\\\": 1, \\\"offset\\\": 168387}, {\\\"time\\\": 2, \\\"offset\\\": 221604}, {\\\"time\\\": 3, \\\"offset\\\": 273483}, {\\\"time\\\": 4, \\\"offset\\\": 345179}, {\\\"time\\\": 5, \\\"offset\\\": 422980}, {\\\"time\\\": 10, \\\"offset\\\": 743211}]\",\"mvmaf\":\"{\\\"v2.0\\\": {\\\"ori\\\": {\\\"v1080\\\": 83.272, \\\"v960\\\": 85.389, \\\"v864\\\": 87.508, \\\"v720\\\": 91.423}, \\\"srv1\\\": {\\\"v1080\\\": 93.685, \\\"v960\\\": 95.135, \\\"v864\\\": 97.262, \\\"v720\\\": 97.823}}}\",\"volume_info_json\":\"\",\"transcode_feature_id\":\"d2855c583ab7dd2f69b34dc4f402cebc\"}"
            },
            {
              "HDR_bit": "",
              "HDR_type": "",
              "bit_rate": 423048,
              "dub_infos": null,
              "fps": 29,
              "gear_name": "lowest_540_1",
              "is_bytevc1": 1,
              "play_addr": {
                "data_size": 4434132,
                "file_cs": "c:0-70516-95a8",
                "file_hash": "e3dcb43f7887fb1554b3b9268139b20e",
                "height": 1024,
                "uri": "v12044gd0000cn4suufog65pkilpo7og",
                "url_key": "v12044gd0000cn4suufog65pkilpo7og_bytevc1_540p_423048",
                "url_list": [
                  "https://v45.tiktokcdn-eu.com/958f3d37e14b7f1f0dc288fcf8321122/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/oQfRIEepx58HpEK2HLBHEhuwgQimDlAcycBSOi/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=826&bt=413&cs=2&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=5&rc=M2VoNGc3NTY5PDozaDloZEBpajpzbHM5cnh2cTMzZzczNEAzYDEzXmNgXzExX2JhNi5hYSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00095000",
                  "https://v15m.tiktokcdn-eu.com/6a27379e60b0b1da7e04616639108e8c/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/oQfRIEepx58HpEK2HLBHEhuwgQimDlAcycBSOi/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=826&bt=413&cs=2&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=5&rc=M2VoNGc3NTY5PDozaDloZEBpajpzbHM5cnh2cTMzZzczNEAzYDEzXmNgXzExX2JhNi5hYSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00090000",
                  "https://api16-normal-no1a.tiktokv.eu/aweme/v1/play/?faid=1233&file_id=da1e96dee0b74946b3c2f4ad614ecb60&is_play_url=1&item_id=7334621391758642478&line=0&signaturev3=dmlkZW9faWQ7ZmlsZV9pZDtpdGVtX2lkLjM0NjgxMjA5YmQ5NTljZGE0NTY1NzdmYzNmZjYwNjQ4&source=SEARCH&video_id=v12044gd0000cn4suufog65pkilpo7og"
                ],
                "url_prefix": null,
                "width": 576
              },
              "quality_type": 25,
              "video_extra": "{\"PktOffsetMap\":\"[{\\\"time\\\": 1, \\\"offset\\\": 145734}, {\\\"time\\\": 2, \\\"offset\\\": 185384}, {\\\"time\\\": 3, \\\"offset\\\": 221887}, {\\\"time\\\": 4, \\\"offset\\\": 273805}, {\\\"time\\\": 5, \\\"offset\\\": 332431}, {\\\"time\\\": 10, \\\"offset\\\": 564555}]\",\"mvmaf\":\"{\\\"v2.0\\\": {\\\"ori\\\": {\\\"v1080\\\": 76.528, \\\"v960\\\": 79.549, \\\"v864\\\": 82.567, \\\"v720\\\": 84.95}, \\\"srv1\\\": {\\\"v1080\\\": 89.89, \\\"v960\\\": 90.903, \\\"v864\\\": 93.268, \\\"v720\\\": 94.373}}}\",\"volume_info_json\":\"\",\"transcode_feature_id\":\"9f7ecae6b607b2366cb8ae4b724963ff\"}"
            }
          ],
          "bit_rate_audio": [],
          "cdn_url_expired": 0,
          "cla_info": {
            "caption_infos": [
              {
                "caption_format": "webvtt",
                "caption_length": 873,
                "cla_subtitle_id": 7376845579634347000,
                "complaint_id": 7376845579634347000,
                "expire": 1740343667,
                "is_auto_generated": true,
                "is_original_caption": true,
                "lang": "eng-US",
                "language_code": "en",
                "language_id": 2,
                "source_tag": "vv_counter,",
                "sub_id": 2047400632,
                "sub_version": "1",
                "subtitle_type": 1,
                "translation_type": 0,
                "translator_id": 0,
                "url": "https://v19-cla.tiktokcdn.com/5a9919cbdac900a6544f6caf1c9fa3f0/67bb8973/video/tos/maliva/tos-maliva-v-0068c799-us/26a0a8e1a034416e8a1734e3d245b60e/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=3280&bt=1640&cs=0&ds=6&ft=4flrFMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=13&rc=ajpzbHM5cnh2cTMzZzczNEBpajpzbHM5cnh2cTMzZzczNEBsbGloMmRjcjFgLS1kMS9zYSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00050000",
                "url_list": [
                  "https://v19-cla.tiktokcdn.com/5a9919cbdac900a6544f6caf1c9fa3f0/67bb8973/video/tos/maliva/tos-maliva-v-0068c799-us/26a0a8e1a034416e8a1734e3d245b60e/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=3280&bt=1640&cs=0&ds=6&ft=4flrFMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=13&rc=ajpzbHM5cnh2cTMzZzczNEBpajpzbHM5cnh2cTMzZzczNEBsbGloMmRjcjFgLS1kMS9zYSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00050000",
                  "https://v16-cla.tiktokcdn.com/41f9a71520ffa82bc727f1dd1cbaa865/67bb8973/video/tos/maliva/tos-maliva-v-0068c799-us/26a0a8e1a034416e8a1734e3d245b60e/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=3280&bt=1640&cs=0&ds=6&ft=4flrFMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=13&rc=ajpzbHM5cnh2cTMzZzczNEBpajpzbHM5cnh2cTMzZzczNEBsbGloMmRjcjFgLS1kMS9zYSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00050000",
                  "https://vas-useast2a.tiktokv.com/tiktok/v1/subtitle/url?aid=1233&format=webvtt&language=eng-US&sign=8873cb355340953e53cbf5693dbb12da&version=1%3Awhisper_lid&vid=v12044gd0000cn4suufog65pkilpo7og"
                ],
                "variant": "whisper_lid"
              }
            ],
            "captions_type": 1,
            "creator_edited_caption_id": 0,
            "enable_auto_caption": 0,
            "has_original_audio": 1,
            "hide_original_caption": false,
            "no_caption_reason": 0,
            "original_language_info": {
              "can_translate_realtime": false,
              "can_translate_realtime_skip_translation_lang_check": true,
              "first_subtitle_time": 0,
              "is_burnin_caption": false,
              "lang": "eng-US",
              "language_code": "en",
              "language_id": 2,
              "original_caption_type": 1
            },
            "vertical_positions": null
          },
          "cover": {
            "height": 720,
            "uri": "tos-useast5-p-0068-tx/ociku3REEDAf4IXJAlOgKxpcSBieHzyBcmY8K5",
            "url_list": [
              "https://p16-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/ociku3REEDAf4IXJAlOgKxpcSBieHzyBcmY8K5~c5_500x800.jpeg?biz_tag=musically_video.video_cover&lk3s=c1333099&nonce=7655&refresh_token=ddf9311cd116befba20f27654a370ff5&shcp=-&shp=c1333099&x-expires=1737770400&x-signature=HOqh9FS%2BV8GXaCkPJ4KdvRYirmI%3D",
              "https://p19-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/ociku3REEDAf4IXJAlOgKxpcSBieHzyBcmY8K5~c5_500x800.jpeg?biz_tag=musically_video.video_cover&lk3s=c1333099&nonce=44217&refresh_token=083ae61a2300d5e8f99ae6389ea210cc&shcp=-&shp=c1333099&x-expires=1737770400&x-signature=%2FEadknBMjqJxxVET1086OXC8yhI%3D"
            ],
            "url_prefix": null,
            "width": 720
          },
          "download_addr": {
            "data_size": 19157722,
            "file_cs": "c:0-68150-dd61",
            "height": 720,
            "uri": "v12044gd0000cn4suufog65pkilpo7og",
            "url_list": [
              "https://v45.tiktokcdn-eu.com/3ce05877e4cf101fc2b78c0ee6b01f15/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/o8IEJilpcBSHDuBEEfP7RSQgiB0Kxy58cTeARB/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=3568&bt=1784&cs=0&ds=3&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=0&rc=PDM0Z2Q0ZGhpZTtnZjk0OkBpajpzbHM5cnh2cTMzZzczNEAtYzQ0YS41Ni0xYmFgLjUxYSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00095000",
              "https://v15m.tiktokcdn-eu.com/37ca7a246efb105f4449b878c78ef34c/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/o8IEJilpcBSHDuBEEfP7RSQgiB0Kxy58cTeARB/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=3568&bt=1784&cs=0&ds=3&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=0&rc=PDM0Z2Q0ZGhpZTtnZjk0OkBpajpzbHM5cnh2cTMzZzczNEAtYzQ0YS41Ni0xYmFgLjUxYSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00090000",
              "https://api16-normal-no1a.tiktokv.eu/aweme/v1/play/?video_id=v12044gd0000cn4suufog65pkilpo7og&line=0&watermark=1&logo_name=tiktok_m&source=SEARCH&file_id=478116ccdde84b0f9e8a11da7d71f009&item_id=7334621391758642478&signaturev3=dmlkZW9faWQ7ZmlsZV9pZDtpdGVtX2lkLjVjNGJiMzdhY2FkMmQ3ZjEyYWZiOGY3ZWIzNGM3Yzg4&shp=d05b14bd&shcp=-"
            ],
            "url_prefix": null,
            "width": 720
          },
          "download_no_watermark_addr": {
            "data_size": 17610810,
            "file_cs": "c:0-68150-dd61",
            "file_hash": "58594bea0fc2d2e561ab7a40ce45d591",
            "height": 1024,
            "uri": "v12044gd0000cn4suufog65pkilpo7og",
            "url_key": "v12044gd0000cn4suufog65pkilpo7og_h264_540p_1680200",
            "url_list": [
              "https://v45.tiktokcdn-eu.com/00a6a618bed56887cca393e2462d3f64/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/oo0EifcT4gTRDphIgczEA5BSnDyFQJeVlP9Sl2/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=3280&bt=1640&cs=0&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=0&rc=NTc2ZDc3NzM7N2gzZjk7PEBpajpzbHM5cnh2cTMzZzczNEAtYzAzMS4tXy0xMV4tNDQ0YSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00095000",
              "https://v15m.tiktokcdn-eu.com/f9357f96d6fd336686305b98bcc055d0/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/oo0EifcT4gTRDphIgczEA5BSnDyFQJeVlP9Sl2/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=3280&bt=1640&cs=0&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=0&rc=NTc2ZDc3NzM7N2gzZjk7PEBpajpzbHM5cnh2cTMzZzczNEAtYzAzMS4tXy0xMV4tNDQ0YSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00090000",
              "https://api16-normal-no1a.tiktokv.eu/aweme/v1/play/?faid=1233&file_id=7978760ca04e4408b00414446a33f402&is_play_url=1&item_id=7334621391758642478&line=0&signaturev3=dmlkZW9faWQ7ZmlsZV9pZDtpdGVtX2lkLjM1MjMwODg5NzUyNDIyYzY4YWM4ZTk5MmY1ZWMwM2Q0&source=SEARCH&video_id=v12044gd0000cn4suufog65pkilpo7og"
            ],
            "url_prefix": null,
            "width": 576
          },
          "duration": 83851,
          "dynamic_cover": {
            "height": 720,
            "uri": "tos-useast5-p-0068-tx/3a1359963da94ff3a1717140ebacf30a_1707724684",
            "url_list": [
              "https://p16-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/3a1359963da94ff3a1717140ebacf30a_1707724684~tplv-tiktokx-origin.image?dr=9229&nonce=48562&refresh_token=65e7ba1ab2227746267fc677122f91c4&x-expires=1737835200&x-signature=5zD%2B%2BDcC1tYyyOOR%2BPcR8sAmGh4%3D&biz_tag=tt_video&idc=no1a&ps=4f5296ae&s=SEARCH&sc=cover&shcp=c1333099&shp=d05b14bd&t=bacd0480",
              "https://p19-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/3a1359963da94ff3a1717140ebacf30a_1707724684~tplv-tiktokx-origin.image?dr=9229&nonce=32909&refresh_token=0e8a737a1764a8866160fa0dc16045f8&x-expires=1737835200&x-signature=zM4%2BgfYSqiteMWTQTGf37O8%2FWk0%3D&biz_tag=tt_video&idc=no1a&ps=4f5296ae&s=SEARCH&sc=cover&shcp=c1333099&shp=d05b14bd&t=bacd0480"
            ],
            "url_prefix": null,
            "width": 720
          },
          "has_watermark": true,
          "height": 1024,
          "is_bytevc1": 0,
          "is_callback": true,
          "is_long_video": 1,
          "meta": "{\"LoudnessRange\":\"4.6\",\"LoudnessRangeEnd\":\"-20\",\"LoudnessRangeStart\":\"-24.7\",\"MaximumMomentaryLoudness\":\"-6.4\",\"MaximumShortTermLoudness\":\"-13.3\",\"Version\":\"2\",\"VolumeInfoJson\":\"{\\\"LoudnessRangeStart\\\":-24.7,\\\"LoudnessRangeEnd\\\":-20,\\\"LoudnessRange\\\":4.6,\\\"Loudness\\\":-21.3,\\\"MaximumShortTermLoudness\\\":-13.3,\\\"Version\\\":2,\\\"Metrics\\\":{\\\"Version\\\":\\\"1.4.2\\\",\\\"Loudness\\\":{\\\"Integrated\\\":-21.274},\\\"Phase\\\":{\\\"RMSDownmixDiff\\\":-0.191},\\\"RMSStats\\\":{\\\"LRDiff\\\":0.101,\\\"Peak\\\":0.086,\\\"LTotal\\\":-23.68,\\\"RTotal\\\":-23.781},\\\"Cutoff\\\":{\\\"FCenL\\\":2863.67,\\\"FCenR\\\":2920.98,\\\"Spkr200G\\\":0.99,\\\"Spkr150G\\\":0.89,\\\"Spkr100G\\\":0.58},\\\"AEDInfo\\\":{\\\"SpeechRatio\\\":0.45,\\\"MusicRatio\\\":0.37,\\\"SingingRatio\\\":0}},\\\"Peak\\\":1,\\\"MaximumMomentaryLoudness\\\":-6.4}\",\"flight_id\":\"\",\"loudness\":\"-21.3\",\"peak\":\"1\",\"play_time_prob_dist\":\"[800,0.4459,7720.6125]\",\"qprf\":\"1.000\",\"sr_score\":\"1.000\",\"vq_score\":\"68.65\"}",
          "need_set_token": false,
          "origin_cover": {
            "height": 720,
            "uri": "tos-useast5-p-0068-tx/bd10d003abeb4e9e842735ed0cfa1078_1707724683",
            "url_list": [
              "https://p16-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/bd10d003abeb4e9e842735ed0cfa1078_1707724683~tplv-dmt-adapt-360p.heic?dr=1360&nonce=4162&refresh_token=d5794f561b14109373b15b8ce8257220&x-expires=1737835200&x-signature=Z1g4K3pWmv8urvcmxbVbcuJl8VM%3D&biz_tag=tt_video&idc=no1a&ps=d97f9a4f&s=SEARCH&sc=cover&shcp=c1333099&shp=d05b14bd&t=bacd0480",
              "https://p19-sign.tiktokcdn-us.com/tos-useast5-p-0068-tx/bd10d003abeb4e9e842735ed0cfa1078_1707724683~tplv-dmt-adapt-360p.heic?dr=1360&nonce=6707&refresh_token=79fcef448fa9a101e9550195f87c6299&x-expires=1737835200&x-signature=HiQ91lbnpoKKS9n8v5DTBNjcIPE%3D&biz_tag=tt_video&idc=no1a&ps=d97f9a4f&s=SEARCH&sc=cover&shcp=c1333099&shp=d05b14bd&t=bacd0480"
            ],
            "url_prefix": null,
            "width": 720
          },
          "play_addr": {
            "data_size": 17610810,
            "file_cs": "c:0-68150-dd61",
            "file_hash": "58594bea0fc2d2e561ab7a40ce45d591",
            "height": 1024,
            "uri": "v12044gd0000cn4suufog65pkilpo7og",
            "url_key": "v12044gd0000cn4suufog65pkilpo7og_h264_540p_1680200",
            "url_list": [
              "https://v45.tiktokcdn-eu.com/00a6a618bed56887cca393e2462d3f64/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/oo0EifcT4gTRDphIgczEA5BSnDyFQJeVlP9Sl2/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=3280&bt=1640&cs=0&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=0&rc=NTc2ZDc3NzM7N2gzZjk7PEBpajpzbHM5cnh2cTMzZzczNEAtYzAzMS4tXy0xMV4tNDQ0YSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00095000",
              "https://v15m.tiktokcdn-eu.com/f9357f96d6fd336686305b98bcc055d0/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/oo0EifcT4gTRDphIgczEA5BSnDyFQJeVlP9Sl2/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=3280&bt=1640&cs=0&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=0&rc=NTc2ZDc3NzM7N2gzZjk7PEBpajpzbHM5cnh2cTMzZzczNEAtYzAzMS4tXy0xMV4tNDQ0YSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00090000",
              "https://api16-normal-no1a.tiktokv.eu/aweme/v1/play/?faid=1233&file_id=7978760ca04e4408b00414446a33f402&is_play_url=1&item_id=7334621391758642478&line=0&signaturev3=dmlkZW9faWQ7ZmlsZV9pZDtpdGVtX2lkLjM1MjMwODg5NzUyNDIyYzY4YWM4ZTk5MmY1ZWMwM2Q0&source=SEARCH&video_id=v12044gd0000cn4suufog65pkilpo7og"
            ],
            "url_prefix": null,
            "width": 576
          },
          "play_addr_bytevc1": {
            "data_size": 7551089,
            "file_cs": "c:0-70516-ba01",
            "file_hash": "097f81f42691eb4aa88a8c82b6a4fd17",
            "height": 1024,
            "uri": "v12044gd0000cn4suufog65pkilpo7og",
            "url_key": "v12044gd0000cn4suufog65pkilpo7og_bytevc1_540p_720429",
            "url_list": [
              "https://v45.tiktokcdn-eu.com/2d6f54b76b0410de1fc746eb33927f56/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/ooIE2ilpcBHHDuB9EfpIMSQgiAwKxy58c5eARn/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=1406&bt=703&cs=2&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=11&rc=Ojg8OzpmaDw0NjQ8PDs2Z0BpajpzbHM5cnh2cTMzZzczNEBfYy0zMDU0NjQxXjI2Li5eYSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00095000",
              "https://v15m.tiktokcdn-eu.com/be0584bbe52b4f0e09977622b389fb65/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/ooIE2ilpcBHHDuB9EfpIMSQgiAwKxy58c5eARn/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=1406&bt=703&cs=2&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=11&rc=Ojg8OzpmaDw0NjQ8PDs2Z0BpajpzbHM5cnh2cTMzZzczNEBfYy0zMDU0NjQxXjI2Li5eYSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00090000",
              "https://api16-normal-no1a.tiktokv.eu/aweme/v1/play/?faid=1233&file_id=ad13189959a14371997e8c376809f5b7&is_play_url=1&item_id=7334621391758642478&line=0&signaturev3=dmlkZW9faWQ7ZmlsZV9pZDtpdGVtX2lkLmM5ZjlkNmE0YTljZTgzN2QzOTlmMmNlNGNlMGFlZjc3&source=SEARCH&video_id=v12044gd0000cn4suufog65pkilpo7og"
            ],
            "url_prefix": null,
            "width": 576
          },
          "play_addr_h264": {
            "data_size": 17610810,
            "file_cs": "c:0-68150-dd61",
            "file_hash": "58594bea0fc2d2e561ab7a40ce45d591",
            "height": 1024,
            "uri": "v12044gd0000cn4suufog65pkilpo7og",
            "url_key": "v12044gd0000cn4suufog65pkilpo7og_h264_540p_1680200",
            "url_list": [
              "https://v45.tiktokcdn-eu.com/00a6a618bed56887cca393e2462d3f64/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/oo0EifcT4gTRDphIgczEA5BSnDyFQJeVlP9Sl2/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=3280&bt=1640&cs=0&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=0&rc=NTc2ZDc3NzM7N2gzZjk7PEBpajpzbHM5cnh2cTMzZzczNEAtYzAzMS4tXy0xMV4tNDQ0YSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00095000",
              "https://v15m.tiktokcdn-eu.com/f9357f96d6fd336686305b98bcc055d0/67954df3/video/tos/maliva/tos-maliva-ve-0068c799-us/oo0EifcT4gTRDphIgczEA5BSnDyFQJeVlP9Sl2/?a=1233&bti=NEBzNTY6QGo6OjZALnAjNDQuYCMxNDNg&ch=0&cr=13&dr=0&er=0&lr=all&net=0&cd=0%7C0%7C0%7C&cv=1&br=3280&bt=1640&cs=0&ds=6&ft=pCXrRMVc8Zmo0lBScb4jV~Y.p31rKsd.&mime_type=video_mp4&qs=0&rc=NTc2ZDc3NzM7N2gzZjk7PEBpajpzbHM5cnh2cTMzZzczNEAtYzAzMS4tXy0xMV4tNDQ0YSNsbGloMmRjcjFgLS1kMS9zcw%3D%3D&vvpl=1&l=2025012420462477D7BDF0C82176619A80&btag=e00090000",
              "https://api16-normal-no1a.tiktokv.eu/aweme/v1/play/?faid=1233&file_id=7978760ca04e4408b00414446a33f402&is_play_url=1&item_id=7334621391758642478&line=0&signaturev3=dmlkZW9faWQ7ZmlsZV9pZDtpdGVtX2lkLjM1MjMwODg5NzUyNDIyYzY4YWM4ZTk5MmY1ZWMwM2Q0&source=SEARCH&video_id=v12044gd0000cn4suufog65pkilpo7og"
            ],
            "url_prefix": null,
            "width": 576
          },
          "ratio": "540p",
          "source_HDR_type": 0,
          "tags": null,
          "video_model": "",
          "width": 576
        },
        "video_control": {
          "allow_download": false,
          "allow_duet": true,
          "allow_dynamic_wallpaper": true,
          "allow_music": true,
          "allow_react": true,
          "allow_stitch": true,
          "draft_progress_bar": 1,
          "prevent_download_type": 2,
          "share_type": 0,
          "show_progress_bar": 1,
          "timer_status": 1
        },
        "video_labels": [],
        "video_text": [],
        "visual_search_info": {},
        "voice_filter_ids": null,
        "with_promotional_music": false,
        "without_watermark": false
      },
      "search_aweme_info": {
        "has_creation_intention": false
      }
    }
  ]
}
  
  
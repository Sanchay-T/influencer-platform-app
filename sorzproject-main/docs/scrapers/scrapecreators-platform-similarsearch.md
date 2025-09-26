Here are the details:
  
  Endpoint: GET https://api.scrapecreators.com/v1/instagram/profile
  
  Description: Gets public Instagram profile data, recent posts, and related accounts
  
  Required Headers:
  - x-api-key: Your API key
  
  Parameters:
  - handle (string) (Required): Instagram handle
  
  Example Response:
  {
  "data": {
    "user": {
      "ai_agent_type": null,
      "biography": "Scraping the web",
      "bio_links": [
        {
          "title": "Social Media APIs",
          "lynx_url": "https://l.instagram.com/?u=https%3A%2F%2Fscrapecreators.com%2F&e=AT32oytzGxbTPpiHKaOPg3a8nbqySwACFQBVT0tShRMXoo7PirvOqfORNEZntjWlzshBsugLij6QzvWi-lCCezNsWqPZ5Hqn",
          "url": "https://scrapecreators.com",
          "link_type": "external"
        },
        {
          "title": "My web scraping course!",
          "lynx_url": "https://l.instagram.com/?u=https%3A%2F%2Fadrianhorning.gumroad.com%2Fl%2Fthe-ultimate-web-scraping-course&e=AT0uTJJ07i9_2izRTv3b5eJZmvs4X2lOY0oAnYQ0LoEDxqxoRTIuiq9-aqf4iLjR3fDY7BAR10BBZTUsMKVvfAOxkeaobgyN",
          "url": "https://adrianhorning.gumroad.com/l/the-ultimate-web-scraping-course",
          "link_type": "external"
        }
      ],
      "fb_profile_biolink": null,
      "biography_with_entities": {
        "raw_text": "Scraping the web",
        "entities": []
      },
      "blocked_by_viewer": false,
      "restricted_by_viewer": null,
      "country_block": false,
      "eimu_id": "114948679895803",
      "external_url": "https://scrapecreators.com/",
      "external_url_linkshimmed": "https://l.instagram.com/?u=https%3A%2F%2Fscrapecreators.com%2F&e=AT2QOyCnbcuRIU7Z3_mHRtDkxiraSpS0fZqZKz2lP2lftK23jiEso9nNpoROavW_OaKmTb-9giBBrQ3hKFIgQGwmsmq--jB9",
      "edge_followed_by": {
        "count": 25116
      },
      "fbid": "17841402777077586",
      "followed_by_viewer": false,
      "edge_follow": {
        "count": 101
      },
      "follows_viewer": false,
      "full_name": "Adrian Horning",
      "group_metadata": null,
      "has_ar_effects": false,
      "has_clips": true,
      "has_guides": false,
      "has_channel": false,
      "has_blocked_viewer": false,
      "highlight_reel_count": 0,
      "has_onboarded_to_text_post_app": true,
      "has_requested_viewer": false,
      "hide_like_and_view_counts": false,
      "id": "2700692569",
      "is_business_account": true,
      "is_professional_account": true,
      "is_supervision_enabled": false,
      "is_guardian_of_viewer": false,
      "is_supervised_by_viewer": false,
      "is_supervised_user": false,
      "is_embeds_disabled": false,
      "is_joined_recently": false,
      "guardian_id": null,
      "business_address_json": "{\"city_name\": \"Austin, Texas\", \"city_id\": 106224666074625, \"latitude\": 30.26759, \"longitude\": -97.74299, \"street_address\": null, \"zip_code\": null}",
      "business_contact_method": "UNKNOWN",
      "business_email": null,
      "business_phone_number": null,
      "business_category_name": "None",
      "overall_category_name": null,
      "category_enum": null,
      "category_name": "Entrepreneur",
      "is_private": false,
      "is_verified": true,
      "is_verified_by_mv4b": false,
      "is_regulated_c18": false,
      "edge_mutual_followed_by": {
        "count": 0,
        "edges": []
      },
      "pinned_channels_list_count": 0,
      "profile_pic_url": "https://scontent-iad3-1.cdninstagram.com/v/t51.2885-19/430086429_362220943449758_2621012714660517106_n.jpg?stp=dst-jpg_e0_s150x150_tt6&_nc_ht=scontent-iad3-1.cdninstagram.com&_nc_cat=102&_nc_ohc=bQwYevo7DQIQ7kNvgFIVNZE&_nc_gid=fca53e0e047a4c5f93d520676b6366b5&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AYAiPpD6ibLR9blNyb59-KNrQjsyYe3o1UkTyjK_fG92dw&oe=6799C629&_nc_sid=8b3546",
      "profile_pic_url_hd": "https://scontent-iad3-1.cdninstagram.com/v/t51.2885-19/430086429_362220943449758_2621012714660517106_n.jpg?stp=dst-jpg_s320x320_tt6&_nc_ht=scontent-iad3-1.cdninstagram.com&_nc_cat=102&_nc_ohc=bQwYevo7DQIQ7kNvgFIVNZE&_nc_gid=fca53e0e047a4c5f93d520676b6366b5&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AYB5Q4gPMQ1Qm2hPTXH8rEpUEPkDxd0pRuPA6QdBf37jPQ&oe=6799C629&_nc_sid=8b3546",
      "requested_by_viewer": false,
      "should_show_category": false,
      "should_show_public_contacts": true,
      "show_account_transparency_details": true,
      "show_text_post_app_badge": false,
      "remove_message_entrypoint": false,
      "transparency_label": null,
      "transparency_product": null,
      "username": "adrianhorning",
      "connected_fb_page": null,
      "pronouns": [],
      "edge_felix_video_timeline": {
        "count": 0,
        "page_info": {
          "has_next_page": false,
          "end_cursor": null
        },
        "edges": []
      },
      "edge_owner_to_timeline_media": {
        "count": 71,
        "page_info": {
          "has_next_page": true,
          "end_cursor": "QVFDdUZKSGhpeXExcGp5SVppc09Pd1lNbDhkSEZfeDhzUlNwaThFTlNZckdmZG40Q2hKSmxuX1FVS3dlbmpqWkVvMTBGUkVvSklVMWktWEx2T1JlRGlFQw=="
        },
        "edges": [
          {
            "node": {
              "__typename": "GraphVideo",
              "id": "3540614075954356349",
              "shortcode": "DEiyb48AeB9",
              "dimensions": {
                "height": 1920,
                "width": 1080
              },
              "display_url": "https://scontent-iad3-2.cdninstagram.com/v/t51.2885-15/472965900_18326364268092570_5931185706033057724_n.jpg?stp=dst-jpg_e35_p1080x1080_sh0.08_tt6&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_cat=106&_nc_ohc=xKs91h4eoI0Q7kNvgHoonkr&_nc_gid=fca53e0e047a4c5f93d520676b6366b5&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AYB7Jx1JWWnRAzhY4FuHx8q2tnLUVKiIBtPtUJUcjtNJkw&oe=6799BC5B&_nc_sid=8b3546",
              "edge_media_to_tagged_user": {
                "edges": []
              },
              "fact_check_overall_rating": null,
              "fact_check_information": null,
              "gating_info": null,
              "sharing_friction_info": {
                "should_have_sharing_friction": false,
                "bloks_app_url": null
              },
              "media_overlay_info": null,
              "media_preview": "ABgqVIyQDwAemTj/AD0p5iOM5X8x3qO2k8k9WK+mTx3GOQevXnkVdScOeMn8Xz+Hz1OgymYGzzjHfkHqcf1op7TGXJXO1RwCT9eck9+ntRQBUcYFPtCCy4Y5BOfp/Ws2e73javA7mhZyi8Hk9Mds8Giw0zZiwRkdCT/OiqUN6oAQ8epH4UVLTC5jU8dKZThWhIoNFNooEf/Z",
              "owner": {
                "id": "2700692569",
                "username": "adrianhorning"
              },
              "is_video": true,
              "has_upcoming_event": false,
              "accessibility_caption": null,
              "has_audio": true,
              "tracking_token": "eyJ2ZXJzaW9uIjo1LCJwYXlsb2FkIjp7ImlzX2FuYWx5dGljc190cmFja2VkIjp0cnVlLCJ1dWlkIjoiZmNhNTNlMGUwNDdhNGM1ZjkzZDUyMDY3NmI2MzY2YjUzNTQwNjE0MDc1OTU0MzU2MzQ5In0sInNpZ25hdHVyZSI6IiJ9",
              "video_url": "https://scontent-iad3-1.cdninstagram.com/o1/v/t16/f2/m86/AQNnK3RhLzpoAq5frHQ4tr0ukvsmz9S1vMh3hrsKqknkqn_5rSMJJ-G4d3m5qQeXaiijzhoXcTJOsWeicR9U11hqAe2aiGLrVgnsq7w.mp4?stp=dst-mp4&efg=eyJxZV9ncm91cHMiOiJbXCJpZ193ZWJfZGVsaXZlcnlfdnRzX290ZlwiXSIsInZlbmNvZGVfdGFnIjoidnRzX3ZvZF91cmxnZW4uY2xpcHMuYzIuNzIwLmJhc2VsaW5lIn0&_nc_cat=104&vs=1270788217346509_2913271887&_nc_vs=HBksFQIYUmlnX3hwdl9yZWVsc19wZXJtYW5lbnRfc3JfcHJvZC8xNTQzRTMyRUZFQTAwNDU0NUNFNTkwNThEQzJDM0U4NF92aWRlb19kYXNoaW5pdC5tcDQVAALIAQAVAhg6cGFzc3Rocm91Z2hfZXZlcnN0b3JlL0dGWTFCaHowdGl1RTIyd0ZBQWVEemNJUFpBQlVicV9FQUFBRhUCAsgBACgAGAAbABUAACaagsiP%2BMePQBUCKAJDMywXQFMt41P3ztkYEmRhc2hfYmFzZWxpbmVfMV92MREAdf4HAA%3D%3D&ccb=9-4&oh=00_AYB4gZagLKrlCAo6WLS3oiRVr_p1fsq008W2I7GZ80uL-g&oe=6795C6C3&_nc_sid=8b3546",
              "video_view_count": 1318,
              "edge_media_to_caption": {
                "edges": []
              },
              "edge_media_to_comment": {
                "count": 12
              },
              "comments_disabled": false,
              "taken_at_timestamp": 1736294201,
              "edge_liked_by": {
                "count": 126
              },
              "edge_media_preview_like": {
                "count": 126
              },
              "location": null,
              "nft_asset_info": null,
              "thumbnail_src": "https://scontent-iad3-2.cdninstagram.com/v/t51.2885-15/472965900_18326364268092570_5931185706033057724_n.jpg?stp=c0.437.1125.1125a_dst-jpg_e35_s640x640_sh0.08_tt6&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_cat=106&_nc_ohc=xKs91h4eoI0Q7kNvgHoonkr&_nc_gid=fca53e0e047a4c5f93d520676b6366b5&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AYDJ48OhYyfP3khEvTSJi109b0RuewgHJS4Oo3BPxdWlgA&oe=6799BC5B&_nc_sid=8b3546",
              "thumbnail_resources": [
                {
                  "src": "https://scontent-iad3-2.cdninstagram.com/v/t51.2885-15/472965900_18326364268092570_5931185706033057724_n.jpg?stp=c0.437.1125.1125a_dst-jpg_e15_s150x150_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6ImltYWdlX3VybGdlbi4xMTI1eDIwMDAuc2RyLmY3NTc2MS5kZWZhdWx0X2NvdmVyX2ZyYW1lIn0&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_cat=106&_nc_ohc=xKs91h4eoI0Q7kNvgHoonkr&_nc_gid=fca53e0e047a4c5f93d520676b6366b5&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AYAmEArV6dtea6W4qgKqo_R_YwsnASoiDvNamqdwPEg79w&oe=6799BC5B&_nc_sid=8b3546",
                  "config_width": 150,
                  "config_height": 150
                },
                {
                  "src": "https://scontent-iad3-2.cdninstagram.com/v/t51.2885-15/472965900_18326364268092570_5931185706033057724_n.jpg?stp=c0.437.1125.1125a_dst-jpg_e15_s240x240_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6ImltYWdlX3VybGdlbi4xMTI1eDIwMDAuc2RyLmY3NTc2MS5kZWZhdWx0X2NvdmVyX2ZyYW1lIn0&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_cat=106&_nc_ohc=xKs91h4eoI0Q7kNvgHoonkr&_nc_gid=fca53e0e047a4c5f93d520676b6366b5&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AYAL85mb-OoBTcFiGndON3_gKESjh028PJ-jUxnzY_2IrQ&oe=6799BC5B&_nc_sid=8b3546",
                  "config_width": 240,
                  "config_height": 240
                },
                {
                  "src": "https://scontent-iad3-2.cdninstagram.com/v/t51.2885-15/472965900_18326364268092570_5931185706033057724_n.jpg?stp=c0.437.1125.1125a_dst-jpg_e15_s320x320_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6ImltYWdlX3VybGdlbi4xMTI1eDIwMDAuc2RyLmY3NTc2MS5kZWZhdWx0X2NvdmVyX2ZyYW1lIn0&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_cat=106&_nc_ohc=xKs91h4eoI0Q7kNvgHoonkr&_nc_gid=fca53e0e047a4c5f93d520676b6366b5&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AYC_ZgYwvcJ6xwGKMuB3dXGOVLD8avzR5zcmXn5o7Azw9g&oe=6799BC5B&_nc_sid=8b3546",
                  "config_width": 320,
                  "config_height": 320
                },
                {
                  "src": "https://scontent-iad3-2.cdninstagram.com/v/t51.2885-15/472965900_18326364268092570_5931185706033057724_n.jpg?stp=c0.437.1125.1125a_dst-jpg_e15_s480x480_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6ImltYWdlX3VybGdlbi4xMTI1eDIwMDAuc2RyLmY3NTc2MS5kZWZhdWx0X2NvdmVyX2ZyYW1lIn0&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_cat=106&_nc_ohc=xKs91h4eoI0Q7kNvgHoonkr&_nc_gid=fca53e0e047a4c5f93d520676b6366b5&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AYDh7TJiCa0QZdvSSYiI4u9D_BmydXH1GMG2qnJEfSG21Q&oe=6799BC5B&_nc_sid=8b3546",
                  "config_width": 480,
                  "config_height": 480
                },
                {
                  "src": "https://scontent-iad3-2.cdninstagram.com/v/t51.2885-15/472965900_18326364268092570_5931185706033057724_n.jpg?stp=c0.437.1125.1125a_dst-jpg_e35_s640x640_sh0.08_tt6&efg=eyJ2ZW5jb2RlX3RhZyI6ImltYWdlX3VybGdlbi4xMTI1eDIwMDAuc2RyLmY3NTc2MS5kZWZhdWx0X2NvdmVyX2ZyYW1lIn0&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_cat=106&_nc_ohc=xKs91h4eoI0Q7kNvgHoonkr&_nc_gid=fca53e0e047a4c5f93d520676b6366b5&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AYDJ48OhYyfP3khEvTSJi109b0RuewgHJS4Oo3BPxdWlgA&oe=6799BC5B&_nc_sid=8b3546",
                  "config_width": 640,
                  "config_height": 640
                }
              ],
              "felix_profile_grid_crop": null,
              "coauthor_producers": [],
              "pinned_for_users": [],
              "viewer_can_reshare": true,
              "like_and_view_counts_disabled": false,
              "product_type": "clips",
              "clips_music_attribution_info": {
                "artist_name": "adrianhorning",
                "song_name": "Original audio",
                "uses_original_audio": true,
                "should_mute_audio": false,
                "should_mute_audio_reason": "",
                "audio_id": "577003721993612"
              }
            }
          }
        ]
      },
      "edge_saved_media": {
        "count": 0,
        "page_info": {
          "has_next_page": false,
          "end_cursor": null
        },
        "edges": []
      },
      "edge_media_collections": {
        "count": 0,
        "page_info": {
          "has_next_page": false,
          "end_cursor": null
        },
        "edges": []
      },
      "edge_related_profiles": {
        "edges": [
          {
            "node": {
              "id": "66873381803",
              "full_name": "ally",
              "is_private": false,
              "is_verified": false,
              "profile_pic_url": "https://scontent-iad3-2.cdninstagram.com/v/t51.2885-19/465249338_1115706923297633_2956285260068952346_n.jpg?stp=dst-jpg_e0_s150x150_tt6&_nc_ht=scontent-iad3-2.cdninstagram.com&_nc_cat=105&_nc_ohc=VDjmLlINuRcQ7kNvgGN3eSS&_nc_gid=fca53e0e047a4c5f93d520676b6366b5&edm=AOQ1c0wBAAAA&ccb=7-5&oh=00_AYBboj0XGYiNsfaQBDRV0gzqn3m8L8PdwFh18sjOW4XOFg&oe=6799E5F1&_nc_sid=8b3546",
              "username": "itsallykrinsky"
            }
          }
        ]
      }
    }
  },
  "status": "ok"
}
  
  
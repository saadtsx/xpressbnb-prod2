export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          created_at: string | null
          email: string
          id: string
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
        }
        Relationships: []
      }
      booking_notification_queue: {
        Row: {
          booking_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json
          processed_at: string | null
          status: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_notification_queue_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_otp_verifications: {
        Row: {
          booking_draft_id: string | null
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          phone: string
        }
        Insert: {
          booking_draft_id?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          phone: string
        }
        Update: {
          booking_draft_id?: string | null
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
        }
        Relationships: []
      }
      bookings: {
        Row: {
          amount_total: number | null
          booking_type: string
          check_in_date: string
          check_out_date: string | null
          checkin: string | null
          checkout: string | null
          created_at: string | null
          customer_reference: string | null
          device_fingerprint: string | null
          guest_email: string
          guest_name: string
          guest_phone: string
          host_decision_at: string | null
          host_decision_note: string | null
          host_id: string | null
          host_viewed_at: string | null
          id: string
          include_decoration: boolean | null
          inquiry_type: string
          nights: number | null
          num_guests: number
          offer_amount: number | null
          offer_message: string | null
          paid_at: string | null
          payment_method: string | null
          payment_status: string | null
          phone_verified: boolean
          phone_verified_at: string | null
          property_id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          review_reason: string | null
          approval_source: string | null
          source: string | null
          spam_score: number | null
          special_requests: string | null
          status: string
          submission_ip: string | null
          time_slot: string | null
          total_price: number
          updated_at: string | null
        }
        Insert: {
          amount_total?: number | null
          booking_type: string
          check_in_date: string
          check_out_date?: string | null
          checkin?: string | null
          checkout?: string | null
          created_at?: string | null
          guest_email: string
          guest_name: string
          guest_phone: string
          host_decision_at?: string | null
          host_decision_note?: string | null
          host_id?: string | null
          id?: string
          include_decoration?: boolean | null
          inquiry_type: string
          nights?: number | null
          num_guests: number
          offer_amount?: number | null
          offer_message?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          property_id: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          source?: string | null
          special_requests?: string | null
          status?: string
          time_slot?: string | null
          total_price: number
        }
        Update: {
          amount_total?: number | null
          booking_type?: string
          check_in_date?: string
          check_out_date?: string | null
          checkin?: string | null
          checkout?: string | null
          created_at?: string | null
          guest_email?: string
          guest_name?: string
          guest_phone?: string
          host_decision_at?: string | null
          host_decision_note?: string | null
          host_id?: string | null
          id?: string
          include_decoration?: boolean | null
          inquiry_type?: string
          nights?: number | null
          num_guests?: number
          offer_amount?: number | null
          offer_message?: string | null
          paid_at?: string | null
          payment_method?: string | null
          payment_status?: string | null
          phone_verified?: boolean
          phone_verified_at?: string | null
          property_id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          source?: string | null
          special_requests?: string | null
          status?: string
          time_slot?: string | null
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "bookings_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      expert_requests: {
        Row: {
          claimed_by: string | null
          completed_at: string | null
          created_at: string | null
          host_id: string
          id: string
          notes: string | null
          property_id: string | null
          status: string | null
        }
        Insert: {
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          host_id: string
          id?: string
          notes?: string | null
          property_id?: string | null
          status?: string | null
        }
        Update: {
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          host_id?: string
          id?: string
          notes?: string | null
          property_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expert_requests_claimed_by_fkey"
            columns: ["claimed_by"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_requests_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expert_requests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      external_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          host_id: string
          id: string
          property_id: string | null
          provider: string
          rating: number
          review_date: string
          reviewer_name: string
          source_url: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string | null
          host_id: string
          id?: string
          property_id?: string | null
          provider: string
          rating: number
          review_date: string
          reviewer_name: string
          source_url?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string | null
          host_id?: string
          id?: string
          property_id?: string | null
          provider?: string
          rating?: number
          review_date?: string
          reviewer_name?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "external_reviews_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_reviews_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_testimonials: {
        Row: {
          avatar_url: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          location: string
          name: string
          quote: string
          rating: number
        }
        Insert: {
          avatar_url?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          location?: string
          name?: string
          quote?: string
          rating?: number
        }
        Update: {
          avatar_url?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          location?: string
          name?: string
          quote?: string
          rating?: number
        }
        Relationships: []
      }
      property_reports: {
        Row: {
          created_at: string
          details: string | null
          device_fingerprint: string | null
          id: string
          property_id: string
          reason: string
          status: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          device_fingerprint?: string | null
          id?: string
          property_id: string
          reason: string
          status?: string
        }
        Update: {
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_reports_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      host_brand_properties: {
        Row: {
          brand_id: string
          created_at: string
          id: string
          property_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          id?: string
          property_id: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          id?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_brand_properties_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "host_brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "host_brand_properties_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      host_brands: {
        Row: {
          business_description: string | null
          business_name: string
          created_at: string
          host_id: string
          id: string
          updated_at: string
        }
        Insert: {
          business_description?: string | null
          business_name: string
          created_at?: string
          host_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          business_description?: string | null
          business_name?: string
          created_at?: string
          host_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "host_brands_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: true
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      hosts: {
        Row: {
          billing_cycle: string
          bio: string | null
          created_at: string | null
          email: string
          id: string
          kyc_status: string | null
          name: string
          payout_details: Json | null
          phone: string
          plan_tier: string
          rating: number | null
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          subscription_next_billing: string | null
          subscription_provider_id: string | null
          subscription_start_date: string | null
          subscription_status: string | null
          total_bookings: number | null
          total_views: number | null
          user_id: string | null
          yearly_discount_percent: number
        }
        Insert: {
          billing_cycle?: string
          bio?: string | null
          created_at?: string | null
          email: string
          id?: string
          kyc_status?: string | null
          name: string
          payout_details?: Json | null
          phone: string
          plan_tier?: string
          rating?: number | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          subscription_next_billing?: string | null
          subscription_provider_id?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          total_bookings?: number | null
          total_views?: number | null
          user_id?: string | null
          yearly_discount_percent?: number
        }
        Update: {
          billing_cycle?: string
          bio?: string | null
          created_at?: string | null
          email?: string
          id?: string
          kyc_status?: string | null
          name?: string
          payout_details?: Json | null
          phone?: string
          plan_tier?: string
          rating?: number | null
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          subscription_next_billing?: string | null
          subscription_provider_id?: string | null
          subscription_start_date?: string | null
          subscription_status?: string | null
          total_bookings?: number | null
          total_views?: number | null
          user_id?: string | null
          yearly_discount_percent?: number
        }
        Relationships: []
      }
      import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string | null
          details: Json | null
          host_id: string
          id: string
          property_id: string | null
          provider: string
          status: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          details?: Json | null
          host_id: string
          id?: string
          property_id?: string | null
          provider: string
          status?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          details?: Json | null
          host_id?: string
          id?: string
          property_id?: string | null
          provider?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          booking_id: string | null
          channel: string
          created_at: string
          error_message: string | null
          event_type: string
          id: string
          locale: string
          message_body: string
          next_retry_at: string | null
          provider: string
          provider_message_id: string | null
          queue_id: string | null
          recipient_phone: string
          recipient_role: string
          retry_count: number
          sent_at: string | null
          status: string
          template_name: string | null
        }
        Insert: {
          booking_id?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          event_type: string
          id?: string
          locale?: string
          message_body: string
          next_retry_at?: string | null
          provider?: string
          provider_message_id?: string | null
          queue_id?: string | null
          recipient_phone: string
          recipient_role: string
          retry_count?: number
          sent_at?: string | null
          status?: string
          template_name?: string | null
        }
        Update: {
          booking_id?: string | null
          channel?: string
          created_at?: string
          error_message?: string | null
          event_type?: string
          id?: string
          locale?: string
          message_body?: string
          next_retry_at?: string | null
          provider?: string
          provider_message_id?: string | null
          queue_id?: string | null
          recipient_phone?: string
          recipient_role?: string
          retry_count?: number
          sent_at?: string | null
          status?: string
          template_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "booking_notification_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      otp_requests: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          phone: string
          purpose: string
          request_ip: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          purpose: string
          request_ip?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          purpose?: string
          request_ip?: string | null
        }
        Relationships: []
      }
      otp_sessions: {
        Row: {
          attempts: number | null
          created_at: string | null
          expires_at: string
          id: string
          otp_hash: string
          phone_number: string
          purpose: string
          verified: boolean | null
          verified_at: string | null
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          expires_at: string
          id?: string
          otp_hash: string
          phone_number: string
          purpose: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          expires_at?: string
          id?: string
          otp_hash?: string
          phone_number?: string
          purpose?: string
          verified?: boolean | null
          verified_at?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          accepts_local_ids: boolean | null
          address: string
          amenities: Json | null
          bathrooms: number
          bedrooms: number
          city: string
          country: string
          created_at: string | null
          description: string
          expert_listed: boolean | null
          external_calendars: Json | null
          external_listings: Json | null
          host_id: string | null
          hourly_stay_available: boolean | null
          id: string
          images: Json | null
          instant_booking: boolean | null
          is_active: boolean | null
          is_couple_friendly: boolean | null
          is_premium: boolean | null
          is_private_space: boolean | null
          is_verified: boolean | null
          latitude: number | null
          listing_type: string | null
          longitude: number | null
          max_guests: number
          no_brokerage: boolean | null
          pay_at_property: boolean | null
          premium_expiry: string | null
          premium_plan: string | null
          premium_stats: Json | null
          price_full_day: number | null
          price_per_day: number
          property_type: string
          rating: number | null
          slug: string | null
          state: string
          stats: Json | null
          title: string
          total_reviews: number | null
          updated_at: string | null
        }
        Insert: {
          accepts_local_ids?: boolean | null
          address: string
          amenities?: Json | null
          bathrooms?: number
          bedrooms?: number
          city: string
          country?: string
          created_at?: string | null
          description: string
          expert_listed?: boolean | null
          external_calendars?: Json | null
          external_listings?: Json | null
          host_id?: string | null
          hourly_stay_available?: boolean | null
          id?: string
          images?: Json | null
          instant_booking?: boolean | null
          is_active?: boolean | null
          is_couple_friendly?: boolean | null
          is_premium?: boolean | null
          is_private_space?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          listing_type?: string | null
          longitude?: number | null
          max_guests?: number
          no_brokerage?: boolean | null
          pay_at_property?: boolean | null
          premium_expiry?: string | null
          premium_plan?: string | null
          premium_stats?: Json | null
          price_full_day?: number | null
          price_per_day?: number
          property_type?: string
          rating?: number | null
          slug?: string | null
          state: string
          stats?: Json | null
          title: string
          total_reviews?: number | null
          updated_at?: string | null
        }
        Update: {
          accepts_local_ids?: boolean | null
          address?: string
          amenities?: Json | null
          bathrooms?: number
          bedrooms?: number
          city?: string
          country?: string
          created_at?: string | null
          description?: string
          expert_listed?: boolean | null
          external_calendars?: Json | null
          external_listings?: Json | null
          host_id?: string | null
          hourly_stay_available?: boolean | null
          id?: string
          images?: Json | null
          instant_booking?: boolean | null
          is_active?: boolean | null
          is_couple_friendly?: boolean | null
          is_premium?: boolean | null
          is_private_space?: boolean | null
          is_verified?: boolean | null
          latitude?: number | null
          listing_type?: string | null
          longitude?: number | null
          max_guests?: number
          no_brokerage?: boolean | null
          pay_at_property?: boolean | null
          premium_expiry?: string | null
          premium_plan?: string | null
          premium_stats?: Json | null
          price_full_day?: number | null
          price_per_day?: number
          property_type?: string
          rating?: number | null
          slug?: string | null
          state?: string
          stats?: Json | null
          title?: string
          total_reviews?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
        ]
      }
      property_ab_tests: {
        Row: {
          completed_at: string | null
          confidence_level: number | null
          created_at: string | null
          id: string
          property_id: string
          started_at: string | null
          status: string | null
          test_type: string
          updated_at: string | null
          variant_a: Json
          variant_a_clicks: number | null
          variant_a_ctr: number | null
          variant_a_impressions: number | null
          variant_b: Json
          variant_b_clicks: number | null
          variant_b_ctr: number | null
          variant_b_impressions: number | null
          winner: string | null
        }
        Insert: {
          completed_at?: string | null
          confidence_level?: number | null
          created_at?: string | null
          id?: string
          property_id: string
          started_at?: string | null
          status?: string | null
          test_type: string
          updated_at?: string | null
          variant_a: Json
          variant_a_clicks?: number | null
          variant_a_ctr?: number | null
          variant_a_impressions?: number | null
          variant_b: Json
          variant_b_clicks?: number | null
          variant_b_ctr?: number | null
          variant_b_impressions?: number | null
          winner?: string | null
        }
        Update: {
          completed_at?: string | null
          confidence_level?: number | null
          created_at?: string | null
          id?: string
          property_id?: string
          started_at?: string | null
          status?: string | null
          test_type?: string
          updated_at?: string | null
          variant_a?: Json
          variant_a_clicks?: number | null
          variant_a_ctr?: number | null
          variant_a_impressions?: number | null
          variant_b?: Json
          variant_b_clicks?: number | null
          variant_b_ctr?: number | null
          variant_b_impressions?: number | null
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_ab_tests_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_analytics: {
        Row: {
          booking_requests: number | null
          city_avg_bookings: number | null
          city_avg_price: number | null
          click_through_rate: number | null
          conversion_rate: number | null
          created_at: string | null
          date: string
          demand_level: string | null
          demand_score: number | null
          id: string
          insights: Json | null
          price_competitiveness: number | null
          property_id: string
          search_impressions: number | null
          total_bookings: number | null
          total_views: number | null
          unique_views: number | null
          updated_at: string | null
          visibility_score: number | null
        }
        Insert: {
          booking_requests?: number | null
          city_avg_bookings?: number | null
          city_avg_price?: number | null
          click_through_rate?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          demand_level?: string | null
          demand_score?: number | null
          id?: string
          insights?: Json | null
          price_competitiveness?: number | null
          property_id: string
          search_impressions?: number | null
          total_bookings?: number | null
          total_views?: number | null
          unique_views?: number | null
          updated_at?: string | null
          visibility_score?: number | null
        }
        Update: {
          booking_requests?: number | null
          city_avg_bookings?: number | null
          city_avg_price?: number | null
          click_through_rate?: number | null
          conversion_rate?: number | null
          created_at?: string | null
          date?: string
          demand_level?: string | null
          demand_score?: number | null
          id?: string
          insights?: Json | null
          price_competitiveness?: number | null
          property_id?: string
          search_impressions?: number | null
          total_bookings?: number | null
          total_views?: number | null
          unique_views?: number | null
          updated_at?: string | null
          visibility_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_analytics_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_calendar: {
        Row: {
          created_at: string
          date: string
          id: string
          is_available: boolean
          minimum_stay: number
          notes: string | null
          price_override: number | null
          property_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          is_available?: boolean
          minimum_stay?: number
          notes?: string | null
          price_override?: number | null
          property_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          is_available?: boolean
          minimum_stay?: number
          notes?: string | null
          price_override?: number | null
          property_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_calendar_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_demand_forecast: {
        Row: {
          confidence_level: string | null
          created_at: string | null
          demand_level: string | null
          demand_score: number | null
          event_factors: Json | null
          forecast_date: string
          forecast_period: string
          id: string
          property_id: string
          reasons: Json | null
        }
        Insert: {
          confidence_level?: string | null
          created_at?: string | null
          demand_level?: string | null
          demand_score?: number | null
          event_factors?: Json | null
          forecast_date: string
          forecast_period: string
          id?: string
          property_id: string
          reasons?: Json | null
        }
        Update: {
          confidence_level?: string | null
          created_at?: string | null
          demand_level?: string | null
          demand_score?: number | null
          event_factors?: Json | null
          forecast_date?: string
          forecast_period?: string
          id?: string
          property_id?: string
          reasons?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "property_demand_forecast_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_growth_scores: {
        Row: {
          completeness_score: number | null
          conversion_score: number | null
          created_at: string | null
          id: string
          overall_score: number
          previous_score: number | null
          pricing_score: number | null
          property_id: string
          response_score: number | null
          score_trend: string | null
          suggestions: Json | null
          updated_at: string | null
        }
        Insert: {
          completeness_score?: number | null
          conversion_score?: number | null
          created_at?: string | null
          id?: string
          overall_score?: number
          previous_score?: number | null
          pricing_score?: number | null
          property_id: string
          response_score?: number | null
          score_trend?: string | null
          suggestions?: Json | null
          updated_at?: string | null
        }
        Update: {
          completeness_score?: number | null
          conversion_score?: number | null
          created_at?: string | null
          id?: string
          overall_score?: number
          previous_score?: number | null
          pricing_score?: number | null
          property_id?: string
          response_score?: number | null
          score_trend?: string | null
          suggestions?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_growth_scores_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_price_suggestions: {
        Row: {
          confidence_level: string | null
          created_at: string | null
          current_price: number
          estimated_booking_increase: number | null
          estimated_revenue_impact: number | null
          id: string
          market_data: Json | null
          optimal_price: number
          property_id: string
          reasoning: Json | null
          suggested_max_price: number
          suggested_min_price: number
          valid_until: string | null
        }
        Insert: {
          confidence_level?: string | null
          created_at?: string | null
          current_price?: number
          estimated_booking_increase?: number | null
          estimated_revenue_impact?: number | null
          id?: string
          market_data?: Json | null
          optimal_price?: number
          property_id: string
          reasoning?: Json | null
          suggested_max_price?: number
          suggested_min_price?: number
          valid_until?: string | null
        }
        Update: {
          confidence_level?: string | null
          created_at?: string | null
          current_price?: number
          estimated_booking_increase?: number | null
          estimated_revenue_impact?: number | null
          id?: string
          market_data?: Json | null
          optimal_price?: number
          property_id?: string
          reasoning?: Json | null
          suggested_max_price?: number
          suggested_min_price?: number
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_price_suggestions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_subscriptions: {
        Row: {
          amount_paid: number | null
          auto_renew: boolean | null
          created_at: string | null
          currency: string | null
          host_id: string
          id: string
          plan_tier: string
          property_id: string
          razorpay_order_id: string | null
          razorpay_payment_id: string | null
          razorpay_subscription_id: string | null
          subscription_end_date: string | null
          subscription_plan: string
          subscription_start_date: string | null
          subscription_status: string
          updated_at: string | null
          yearly_discount_percent: number
        }
        Insert: {
          amount_paid?: number | null
          auto_renew?: boolean | null
          created_at?: string | null
          currency?: string | null
          host_id: string
          id?: string
          plan_tier?: string
          property_id: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_plan?: string
          subscription_start_date?: string | null
          subscription_status?: string
          updated_at?: string | null
          yearly_discount_percent?: number
        }
        Update: {
          amount_paid?: number | null
          auto_renew?: boolean | null
          created_at?: string | null
          currency?: string | null
          host_id?: string
          id?: string
          plan_tier?: string
          property_id?: string
          razorpay_order_id?: string | null
          razorpay_payment_id?: string | null
          razorpay_subscription_id?: string | null
          subscription_end_date?: string | null
          subscription_plan?: string
          subscription_start_date?: string | null
          subscription_status?: string
          updated_at?: string | null
          yearly_discount_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "property_subscriptions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_subscriptions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: true
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      rishikesh_artist_bookings: {
        Row: {
          artist_id: string
          artist_name: string
          created_at: string
          guest_name: string
          guest_phone: string
          id: string
          notes: string
          session_id: string
          slot: string
        }
        Insert: {
          artist_id: string
          artist_name?: string
          created_at?: string
          guest_name?: string
          guest_phone?: string
          id?: string
          notes?: string
          session_id: string
          slot?: string
        }
        Update: {
          artist_id?: string
          artist_name?: string
          created_at?: string
          guest_name?: string
          guest_phone?: string
          id?: string
          notes?: string
          session_id?: string
          slot?: string
        }
        Relationships: []
      }
      rishikesh_saved_properties: {
        Row: {
          created_at: string
          id: string
          property_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          property_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          property_id?: string
          session_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          amount_monthly: number
          created_at: string | null
          currency: string | null
          host_id: string
          id: string
          next_billing_at: string | null
          payment_provider_subscription_id: string | null
          property_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          amount_monthly?: number
          created_at?: string | null
          currency?: string | null
          host_id: string
          id?: string
          next_billing_at?: string | null
          payment_provider_subscription_id?: string | null
          property_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          amount_monthly?: number
          created_at?: string | null
          currency?: string | null
          host_id?: string
          id?: string
          next_billing_at?: string | null
          payment_provider_subscription_id?: string | null
          property_id?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "hosts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      view_events: {
        Row: {
          entity_id: string
          entity_type: string
          id: string
          referrer: string | null
          session_id: string | null
          timestamp: string | null
          visitor_ip_hash: string | null
        }
        Insert: {
          entity_id: string
          entity_type: string
          id?: string
          referrer?: string | null
          session_id?: string | null
          timestamp?: string | null
          visitor_ip_hash?: string | null
        }
        Update: {
          entity_id?: string
          entity_type?: string
          id?: string
          referrer?: string | null
          session_id?: string | null
          timestamp?: string | null
          visitor_ip_hash?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      host_inquiries: {
        Row: Database['public']['Tables']['bookings']['Row'] & {
          contact_released: boolean | null
          quality_review_pending: boolean | null
        }
        Relationships: Database['public']['Tables']['bookings']['Relationships']
      }
    }
    Functions: {
      attach_booking_razorpay_order: {
        Args: { p_booking_id: string; p_razorpay_order_id: string }
        Returns: undefined
      }
      consume_booking_inquiry_otp: {
        Args: { p_guest_phone: string; p_token: string }
        Returns: undefined
      }
      create_make_offer_inquiry: {
        Args: {
          p_check_in: string
          p_check_out: string
          p_guest_email: string
          p_guest_name: string
          p_guest_phone: string
          p_host_id: string
          p_num_guests?: number
          p_offer_amount: number
          p_offer_message?: string
          p_otp_verification_token: string
          p_property_id: string
          p_special_requests?: string
        }
        Returns: Json
      }
      create_pending_booking: {
        Args: {
          p_amount_total: number
          p_check_in: string
          p_check_out: string
          p_device_fingerprint?: string
          p_guest_email: string
          p_guest_name: string
          p_guest_phone: string
          p_host_id: string
          p_include_decoration?: boolean
          p_nights: number
          p_num_guests: number
          p_otp_verification_token?: string
          p_property_id: string
          p_special_requests?: string
          p_submission_ip?: string
          p_total_price: number
          p_turnstile_passed?: boolean
        }
        Returns: Json
      }
      mark_inquiry_viewed_by_host: {
        Args: { p_booking_id: string }
        Returns: undefined
      }
      get_public_property_brand: {
        Args: { p_property_id: string }
        Returns: { brand_name: string; brand_description: string | null }[]
      }
      report_property: {
        Args: {
          p_property_id: string
          p_reason: string
          p_details?: string | null
          p_device_fingerprint?: string | null
        }
        Returns: Json
      }
      replace_host_brand_properties: {
        Args: { p_brand_id: string; p_property_ids?: string[] }
        Returns: string[]
      }
      save_guest_push_subscription: {
        Args: {
          p_auth_key: string
          p_customer_reference: string
          p_endpoint: string
          p_guest_email: string
          p_notification_preferences?: Json
          p_p256dh: string
        }
        Returns: Json
      }
      track_inquiry_by_reference: {
        Args: { p_customer_reference: string; p_guest_email: string }
        Returns: Json
      }
      has_premium_access: { Args: { property_uuid: string }; Returns: boolean }
      host_contact_json_for_host: { Args: { p_host_id: string }; Returns: Json }
      is_property_available: {
        Args: { p_check_in: string; p_check_out: string; p_property_id: string }
        Returns: boolean
      }
      list_property_unavailable_dates: {
        Args: { p_from: string; p_property_id: string; p_to: string }
        Returns: { unavailable_date: string }[]
      }
      update_property_analytics: {
        Args: { p_bookings?: number; p_property_id: string; p_views?: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// Convenience aliases used across the app. Keep below the generated block so
// regenerating via `supabase gen types`/MCP only rewrites the section above.
export type Property = Database['public']['Tables']['properties']['Row']
export type Booking = Database['public']['Tables']['bookings']['Row']
export type Host = Database['public']['Tables']['hosts']['Row']
export type HostBrand = Database['public']['Tables']['host_brands']['Row']
export type HostBrandProperty = Database['public']['Tables']['host_brand_properties']['Row']
export type PropertyCalendarAvailability = Database['public']['Tables']['property_calendar']['Row']
export type ViewEvent = Database['public']['Tables']['view_events']['Row']

// `reviews` is no longer in the public schema (regen on 2026-05-19 dropped it).
// PropertyReviews.tsx still queries the legacy table — keep the shape here so
// the existing UI compiles. Migrate to `external_reviews` in a follow-up.
export interface Review {
  id: string
  property_id: string
  booking_id: string | null
  guest_name: string
  rating: number
  comment: string | null
  created_at: string
}

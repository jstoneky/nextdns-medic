// Domain categorization database for DNS Medic
// Confidence levels: HIGH, MEDIUM, LOW
//   HIGH   = very likely to break site functionality if blocked
//            (feature flags, auth, payments, core APIs, CDNs, search)
//   MEDIUM = may break functionality depending on the site
//            (tag managers, chat, consent, error monitoring, session replay)
//   LOW    = analytics/ads — almost never breaks anything functional
//
// Pattern ordering: more specific patterns come before broader brand patterns
// within each section, so specific entries win when the hostname matches both.
//
// Last updated: 2026-03-26 | ~215 entries

const DOMAIN_DB = [

  // ─── FEATURE FLAGS & EXPERIMENTATION (HIGH) ───────────────────────────────
  // Statsig: uses obfuscated CDN domains to defeat blocklists
  { pattern: /featureassets\.org/,          label: "Feature Flags (Statsig CDN)",         confidence: "HIGH",   category: "feature-flags" },
  { pattern: /statsigapi\.net/,             label: "Feature Flags (Statsig API)",          confidence: "HIGH",   category: "feature-flags" },
  // Statsig uses obfuscated domains to bypass blockers — unverified, treat as MEDIUM until confirmed
  { pattern: /featuregates\.org/,           label: "Feature Flags (Statsig alt)",          confidence: "MEDIUM", category: "feature-flags" },
  { pattern: /prodregistryv2\.org/,         label: "Feature Flags (Statsig alt)",          confidence: "MEDIUM", category: "feature-flags" },
  { pattern: /assetsconfigcdn\.org/,        label: "Feature Flags (Statsig alt)",          confidence: "MEDIUM", category: "feature-flags" },
  { pattern: /beyondwickedmapping\.org/,    label: "Feature Flags (Statsig alt)",          confidence: "MEDIUM", category: "feature-flags" },
  { pattern: /api\.statsig\.com/,           label: "Feature Flags (Statsig API)",          confidence: "HIGH",   category: "feature-flags" },
  { pattern: /statsig/i,                    label: "Feature Flags (Statsig)",              confidence: "HIGH",   category: "feature-flags" },
  // LaunchDarkly
  { pattern: /clientstream\.launchdarkly/,  label: "Feature Flags (LaunchDarkly Stream)",  confidence: "HIGH",   category: "feature-flags" },
  { pattern: /events\.launchdarkly/,        label: "Feature Flags (LaunchDarkly Events)",  confidence: "HIGH",   category: "feature-flags" },
  { pattern: /sdk\.launchdarkly/,           label: "Feature Flags (LaunchDarkly SDK)",     confidence: "HIGH",   category: "feature-flags" },
  { pattern: /launchdarkly/i,               label: "Feature Flags (LaunchDarkly)",         confidence: "HIGH",   category: "feature-flags" },
  // Split.io
  { pattern: /sdk\.split\.io/,              label: "Feature Flags (Split.io SDK)",         confidence: "HIGH",   category: "feature-flags" },
  { pattern: /events\.split\.io/,           label: "Feature Flags (Split.io Events)",      confidence: "HIGH",   category: "feature-flags" },
  { pattern: /auth\.split\.io/,             label: "Feature Flags (Split.io Auth)",        confidence: "HIGH",   category: "feature-flags" },
  { pattern: /split\.io/,                   label: "Feature Flags (Split.io)",             confidence: "HIGH",   category: "feature-flags" },
  // Optimizely
  { pattern: /cdn\.optimizely\.com/,        label: "A/B Testing (Optimizely CDN)",         confidence: "HIGH",   category: "feature-flags" },
  { pattern: /logx\.optimizely\.com/,       label: "A/B Testing (Optimizely Events)",      confidence: "HIGH",   category: "feature-flags" },
  { pattern: /optimizely/i,                 label: "A/B Testing (Optimizely)",             confidence: "HIGH",   category: "feature-flags" },
  // PostHog
  { pattern: /us\.posthog\.com/,            label: "Feature Flags (PostHog US)",           confidence: "HIGH",   category: "feature-flags" },
  { pattern: /eu\.posthog\.com/,            label: "Feature Flags (PostHog EU)",           confidence: "HIGH",   category: "feature-flags" },
  { pattern: /us-assets\.posthog\.com/,     label: "Feature Flags (PostHog US assets)",    confidence: "HIGH",   category: "feature-flags" },
  { pattern: /eu-assets\.posthog\.com/,     label: "Feature Flags (PostHog EU assets)",    confidence: "HIGH",   category: "feature-flags" },
  { pattern: /posthog/i,                    label: "Feature Flags (PostHog)",              confidence: "HIGH",   category: "feature-flags" },
  // GrowthBook
  { pattern: /cdn\.growthbook\.io/,         label: "Feature Flags (GrowthBook CDN)",       confidence: "HIGH",   category: "feature-flags" },
  { pattern: /growthbook/i,                 label: "Feature Flags (GrowthBook)",           confidence: "HIGH",   category: "feature-flags" },
  // ConfigCat
  { pattern: /cdn\.configcat\.com/,         label: "Feature Flags (ConfigCat CDN)",        confidence: "HIGH",   category: "feature-flags" },
  { pattern: /cdn-global\.configcat\.com/,  label: "Feature Flags (ConfigCat Global CDN)", confidence: "HIGH",   category: "feature-flags" },
  { pattern: /configcat/i,                  label: "Feature Flags (ConfigCat)",            confidence: "HIGH",   category: "feature-flags" },
  // Flagsmith
  { pattern: /edge\.api\.flagsmith\.com/,   label: "Feature Flags (Flagsmith Edge)",       confidence: "HIGH",   category: "feature-flags" },
  { pattern: /flagsmith/i,                  label: "Feature Flags (Flagsmith)",            confidence: "HIGH",   category: "feature-flags" },
  // Harness Feature Flags
  { pattern: /ff\.harness\.io/,             label: "Feature Flags (Harness FF)",           confidence: "HIGH",   category: "feature-flags" },
  { pattern: /config\.ff\.harness\.io/,     label: "Feature Flags (Harness FF config)",    confidence: "HIGH",   category: "feature-flags" },
  // Eppo
  { pattern: /fscdn\.eppo\.cloud/,          label: "Feature Flags (Eppo CDN)",             confidence: "HIGH",   category: "feature-flags" },
  { pattern: /eppo\.cloud/,                 label: "Feature Flags (Eppo)",                 confidence: "HIGH",   category: "feature-flags" },
  // Kameleoon
  { pattern: /kameleoon/i,                  label: "A/B Testing (Kameleoon)",              confidence: "HIGH",   category: "feature-flags" },
  // Amplitude Experiment (flags via Amplitude)
  { pattern: /amplitude\.com\/libs/,        label: "Feature Flags (Amplitude Experiment)", confidence: "HIGH",   category: "feature-flags" },
  // Unleash
  { pattern: /unleash/i,                    label: "Feature Flags (Unleash)",              confidence: "HIGH",   category: "feature-flags" },

  // ─── AUTHENTICATION & SESSION (HIGH) ──────────────────────────────────────
  // Auth0 / Okta
  { pattern: /cdn\.auth0\.com/,             label: "Auth (Auth0 CDN)",                     confidence: "HIGH",   category: "auth" },
  { pattern: /auth0\.com/,                  label: "Auth (Auth0)",                         confidence: "HIGH",   category: "auth" },
  { pattern: /cdn\.okta\.com/,              label: "Auth (Okta CDN)",                      confidence: "HIGH",   category: "auth" },
  { pattern: /oktacdn\.com/,                label: "Auth (Okta CDN)",                      confidence: "HIGH",   category: "auth" },
  { pattern: /okta\.com/,                   label: "Auth (Okta)",                          confidence: "HIGH",   category: "auth" },
  { pattern: /okta-emea\.com/,              label: "Auth (Okta EMEA)",                     confidence: "HIGH",   category: "auth" },
  // Microsoft
  { pattern: /login\.microsoftonline\.com/, label: "Auth (Azure AD / Microsoft SSO)",      confidence: "HIGH",   category: "auth" },
  { pattern: /aadcdn\.msftauth\.net/,       label: "Auth (Azure AD CDN)",                  confidence: "HIGH",   category: "auth" },
  { pattern: /aadcdn\.msauth\.net/,         label: "Auth (Azure AD CDN alt)",              confidence: "HIGH",   category: "auth" },
  // Google
  { pattern: /accounts\.google\.com/,       label: "Auth (Google Sign-In)",                confidence: "HIGH",   category: "auth" },
  { pattern: /identitytoolkit\.googleapis/, label: "Auth (Firebase Auth)",                 confidence: "HIGH",   category: "auth" },
  { pattern: /securetoken\.googleapis/,     label: "Auth (Firebase Auth token)",           confidence: "HIGH",   category: "auth" },
  // Apple
  { pattern: /appleid\.apple\.com/,         label: "Auth (Apple Sign-In)",                 confidence: "HIGH",   category: "auth" },
  // AWS Cognito
  { pattern: /cognito.*amazonaws/,          label: "Auth (AWS Cognito)",                   confidence: "HIGH",   category: "auth" },
  // Clerk
  { pattern: /clerkapis\.com/,               label: "Auth (Clerk API)",                     confidence: "HIGH",   category: "auth" },
  { pattern: /clerk\.com/,                  label: "Auth (Clerk)",                         confidence: "HIGH",   category: "auth" },
  { pattern: /clerk\.dev/,                  label: "Auth (Clerk dev)",                     confidence: "HIGH",   category: "auth" },
  // Clerk custom CNAME pattern — clerk.yourdomain.com or accounts.clerk.yourdomain.dev
  { pattern: /(^|\.)clerk\./,               label: "Auth (Clerk)",                         confidence: "HIGH",   category: "auth" },
  // WorkOS
  { pattern: /api\.workos\.com/,            label: "Auth (WorkOS API)",                    confidence: "HIGH",   category: "auth" },
  { pattern: /workos\.com/,                 label: "Auth (WorkOS)",                        confidence: "HIGH",   category: "auth" },
  // Kinde
  { pattern: /kinde\.com/,                  label: "Auth (Kinde)",                         confidence: "HIGH",   category: "auth" },
  // Stytch
  { pattern: /stytch\.com/,                 label: "Auth (Stytch)",                        confidence: "HIGH",   category: "auth" },
  // Magic / Magic Link
  { pattern: /auth\.magic\.link/,           label: "Auth (Magic Link)",                    confidence: "HIGH",   category: "auth" },
  { pattern: /api\.magic\.link/,            label: "Auth (Magic Link API)",                confidence: "HIGH",   category: "auth" },
  // Passage
  { pattern: /passage\.id/,                 label: "Auth (Passage)",                       confidence: "HIGH",   category: "auth" },
  // OneLogin / Ping
  { pattern: /onelogin\.com/,               label: "Auth (OneLogin)",                      confidence: "HIGH",   category: "auth" },
  { pattern: /pingidentity/i,               label: "Auth (Ping Identity)",                 confidence: "HIGH",   category: "auth" },

  // ─── PAYMENT & COMMERCE (HIGH) ────────────────────────────────────────────
  // Stripe
  { pattern: /js\.stripe\.com/,             label: "Payments (Stripe JS)",                 confidence: "HIGH",   category: "payments" },
  { pattern: /api\.stripe\.com/,            label: "Payments (Stripe API)",                confidence: "HIGH",   category: "payments" },
  { pattern: /m\.stripe\.com/,              label: "Payments (Stripe mobile)",             confidence: "HIGH",   category: "payments" },
  { pattern: /stripe\.network/,             label: "Payments (Stripe network CDN)",        confidence: "HIGH",   category: "payments" },
  { pattern: /stripe\.com/,                 label: "Payments (Stripe)",                    confidence: "HIGH",   category: "payments" },
  // Braintree / PayPal
  { pattern: /js\.braintreegateway\.com/,   label: "Payments (Braintree JS)",              confidence: "HIGH",   category: "payments" },
  { pattern: /braintreegateway\.com/,       label: "Payments (Braintree)",                 confidence: "HIGH",   category: "payments" },
  { pattern: /paypalobjects\.com/,          label: "Payments (PayPal assets)",             confidence: "HIGH",   category: "payments" },
  { pattern: /paypal\.com/,                 label: "Payments (PayPal)",                    confidence: "HIGH",   category: "payments" },
  // Square
  { pattern: /js\.squareup\.com/,           label: "Payments (Square JS)",                 confidence: "HIGH",   category: "payments" },
  { pattern: /web\.squarecdn\.com/,         label: "Payments (Square CDN)",                confidence: "HIGH",   category: "payments" },
  { pattern: /squarecdn\.com/,              label: "Payments (Square CDN)",                confidence: "HIGH",   category: "payments" },
  { pattern: /square(up)?\.com/,            label: "Payments (Square)",                    confidence: "HIGH",   category: "payments" },
  // Adyen
  { pattern: /checkoutshopper.*\.adyen\.com/, label: "Payments (Adyen Checkout)",          confidence: "HIGH",   category: "payments" },
  { pattern: /adyen\.com/,                  label: "Payments (Adyen)",                     confidence: "HIGH",   category: "payments" },
  // Klarna
  { pattern: /x\.klarnacdn\.net/,           label: "Payments (Klarna CDN)",                confidence: "HIGH",   category: "payments" },
  { pattern: /klarnacdn\.net/,              label: "Payments (Klarna CDN)",                confidence: "HIGH",   category: "payments" },
  { pattern: /klarna\.com/,                 label: "Payments (Klarna)",                    confidence: "HIGH",   category: "payments" },
  // Afterpay / Clearpay
  { pattern: /afterpay\.com/,               label: "Payments (Afterpay)",                  confidence: "HIGH",   category: "payments" },
  { pattern: /clearpay\.co\.uk/,            label: "Payments (Clearpay UK)",               confidence: "HIGH",   category: "payments" },
  // Affirm
  { pattern: /cdn1\.affirm\.com/,           label: "Payments (Affirm CDN)",                confidence: "HIGH",   category: "payments" },
  { pattern: /affirm\.com/,                 label: "Payments (Affirm)",                    confidence: "HIGH",   category: "payments" },
  // Mollie
  { pattern: /js\.mollie\.com/,             label: "Payments (Mollie JS)",                 confidence: "HIGH",   category: "payments" },
  { pattern: /mollie\.com/,                 label: "Payments (Mollie)",                    confidence: "HIGH",   category: "payments" },
  // Razorpay
  { pattern: /checkout\.razorpay\.com/,     label: "Payments (Razorpay Checkout)",         confidence: "HIGH",   category: "payments" },
  { pattern: /cdn\.razorpay\.com/,          label: "Payments (Razorpay CDN)",              confidence: "HIGH",   category: "payments" },
  { pattern: /razorpay\.com/,               label: "Payments (Razorpay)",                  confidence: "HIGH",   category: "payments" },
  // Chargebee
  { pattern: /js\.chargebee\.com/,          label: "Payments (Chargebee JS)",              confidence: "HIGH",   category: "payments" },
  { pattern: /chargebee\.com/,              label: "Payments (Chargebee)",                 confidence: "HIGH",   category: "payments" },
  // Recurly
  { pattern: /js\.recurly\.com/,            label: "Payments (Recurly JS)",                confidence: "HIGH",   category: "payments" },
  { pattern: /recurly\.com/,                label: "Payments (Recurly)",                   confidence: "HIGH",   category: "payments" },
  // Paddle
  { pattern: /cdn\.paddle\.com/,            label: "Payments (Paddle CDN)",                confidence: "HIGH",   category: "payments" },
  { pattern: /sandbox-cdn\.paddle\.com/,    label: "Payments (Paddle sandbox)",            confidence: "HIGH",   category: "payments" },
  { pattern: /paddle\.com/,                 label: "Payments (Paddle)",                    confidence: "HIGH",   category: "payments" },
  // Sezzle
  { pattern: /sezzle\.com/,                 label: "Payments (Sezzle)",                    confidence: "HIGH",   category: "payments" },
  // Zuora
  { pattern: /static\.zuora\.com/,          label: "Payments (Zuora JS)",                  confidence: "HIGH",   category: "payments" },
  { pattern: /zuora\.com/,                  label: "Payments (Zuora)",                     confidence: "HIGH",   category: "payments" },

  // ─── SEARCH APIs (HIGH — breaks product discovery / site search) ───────────
  // Algolia — uses multiple regional CDN endpoints
  { pattern: /algolia\.net/,                label: "Search (Algolia)",                     confidence: "HIGH",   category: "search-api" },
  { pattern: /algolianet\.com/,             label: "Search (Algolia CDN)",                 confidence: "HIGH",   category: "search-api" },
  { pattern: /algolia\.io/,                 label: "Search (Algolia alt)",                 confidence: "HIGH",   category: "search-api" },
  { pattern: /algolia/i,                    label: "Search (Algolia)",                     confidence: "HIGH",   category: "search-api" },
  // Constructor.io
  { pattern: /ac\.cnstrc\.com/,             label: "Search (Constructor.io autocomplete)",  confidence: "HIGH",   category: "search-api" },
  { pattern: /cnstrc\.com/,                 label: "Search (Constructor.io)",              confidence: "HIGH",   category: "search-api" },
  { pattern: /constructor\.io/,             label: "Search (Constructor.io)",              confidence: "HIGH",   category: "search-api" },
  // Klevu
  { pattern: /klevu/i,                      label: "Search (Klevu)",                       confidence: "HIGH",   category: "search-api" },
  { pattern: /ksearchnet\.com/,             label: "Search (Klevu CDN)",                   confidence: "HIGH",   category: "search-api" },
  // Searchspring
  { pattern: /searchspring/i,               label: "Search (Searchspring)",                confidence: "HIGH",   category: "search-api" },
  // Bloomreach
  { pattern: /bloomreach/i,                 label: "Search (Bloomreach)",                  confidence: "HIGH",   category: "search-api" },
  // Coveo
  { pattern: /cloud\.coveo\.com/,           label: "Search (Coveo Cloud)",                 confidence: "HIGH",   category: "search-api" },
  { pattern: /coveo/i,                      label: "Search (Coveo)",                       confidence: "HIGH",   category: "search-api" },
  // Yext
  { pattern: /cdn\.yextapis\.com/,          label: "Search (Yext CDN)",                    confidence: "HIGH",   category: "search-api" },
  { pattern: /yext/i,                       label: "Search (Yext)",                        confidence: "HIGH",   category: "search-api" },
  // Findify
  { pattern: /cdn\.findify\.io/,            label: "Search (Findify CDN)",                 confidence: "HIGH",   category: "search-api" },
  { pattern: /findify/i,                    label: "Search (Findify)",                     confidence: "HIGH",   category: "search-api" },
  // Elastic
  { pattern: /elastic\.co/,                 label: "Search (Elastic/Elasticsearch)",       confidence: "HIGH",   category: "search-api" },
  // Typesense
  { pattern: /typesense\.net/,              label: "Search (Typesense Cloud)",             confidence: "HIGH",   category: "search-api" },
  // Nosto
  { pattern: /nosto\.com/,                  label: "Personalization (Nosto)",              confidence: "HIGH",   category: "search-api" },

  // ─── CORE CDNs & INFRASTRUCTURE (HIGH) ────────────────────────────────────
  // Cloudflare — cloudflareinsights.com is analytics (MEDIUM), .com is infra (HIGH)
  { pattern: /cloudflareinsights\.com/,     label: "Analytics (Cloudflare Web Analytics)", confidence: "LOW",    category: "analytics" },
  { pattern: /cloudflare\.com/,             label: "CDN (Cloudflare)",                     confidence: "HIGH",   category: "cdn" },
  { pattern: /workers\.dev/,                label: "CDN (Cloudflare Workers)",             confidence: "HIGH",   category: "cdn" },
  { pattern: /pages\.dev/,                  label: "Hosting (Cloudflare Pages)",           confidence: "HIGH",   category: "cdn" },
  // Fastly
  { pattern: /fastly\.net/,                 label: "CDN (Fastly)",                         confidence: "HIGH",   category: "cdn" },
  // Akamai
  { pattern: /akamaihd\.net/,               label: "CDN (Akamai HD)",                      confidence: "HIGH",   category: "cdn" },
  { pattern: /akamaized\.net/,              label: "CDN (Akamai)",                         confidence: "HIGH",   category: "cdn" },
  { pattern: /edgekey\.net/,                label: "CDN (Akamai EdgeKey)",                 confidence: "HIGH",   category: "cdn" },
  { pattern: /akamai/i,                     label: "CDN (Akamai)",                         confidence: "HIGH",   category: "cdn" },
  // Edgio (fka Limelight)
  { pattern: /edgio\.net/,                  label: "CDN (Edgio)",                          confidence: "HIGH",   category: "cdn" },
  { pattern: /llnwd\.net/,                  label: "CDN (Limelight/Edgio)",                confidence: "HIGH",   category: "cdn" },
  // BunnyCDN
  { pattern: /b-cdn\.net/,                  label: "CDN (BunnyCDN)",                       confidence: "HIGH",   category: "cdn" },
  // KeyCDN
  { pattern: /kxcdn\.com/,                  label: "CDN (KeyCDN)",                         confidence: "HIGH",   category: "cdn" },
  // jsDelivr / unpkg / cdnjs (open source CDNs)
  { pattern: /cdn\.jsdelivr\.net/,          label: "CDN (jsDelivr)",                       confidence: "HIGH",   category: "cdn" },
  { pattern: /unpkg\.com/,                  label: "CDN (unpkg)",                          confidence: "HIGH",   category: "cdn" },
  { pattern: /cdnjs\.cloudflare\.com/,      label: "CDN (cdnjs)",                          confidence: "HIGH",   category: "cdn" },
  // AWS / GCP / Google
  { pattern: /amazonaws\.com/,              label: "Cloud (AWS)",                          confidence: "HIGH",   category: "cdn" },
  { pattern: /googleapis\.com/,             label: "APIs (Google APIs)",                   confidence: "HIGH",   category: "cdn" },
  { pattern: /gstatic\.com/,                label: "Assets (Google Static)",               confidence: "HIGH",   category: "cdn" },
  // Shopify CDN (infrastructure, not tracking)
  { pattern: /shopifycloud\.com/,           label: "E-commerce CDN (Shopify Cloud)",       confidence: "HIGH",   category: "cdn" },
  { pattern: /cdn\.shopify\.com/,           label: "E-commerce CDN (Shopify)",             confidence: "HIGH",   category: "cdn" },

  // ─── E-COMMERCE PLATFORMS (HIGH) ─────────────────────────────────────────
  { pattern: /shopify\.com/,                label: "E-commerce (Shopify)",                 confidence: "HIGH",   category: "ecommerce" },
  { pattern: /demandware\.net/,             label: "E-commerce (Salesforce Commerce Cloud)", confidence: "HIGH", category: "ecommerce" },
  { pattern: /demandware\.com/,             label: "E-commerce (Salesforce Commerce Cloud)", confidence: "HIGH", category: "ecommerce" },
  { pattern: /commercetools\.(com|io)/,     label: "E-commerce (Commercetools)",           confidence: "HIGH",   category: "ecommerce" },
  { pattern: /bigcommerce\.com/,            label: "E-commerce (BigCommerce)",             confidence: "HIGH",   category: "ecommerce" },
  { pattern: /bcapp\.net/,                  label: "E-commerce (BigCommerce CDN)",         confidence: "HIGH",   category: "ecommerce" },

  // ─── REAL-TIME / WEBSOCKET (HIGH) ─────────────────────────────────────────
  // Pusher
  { pattern: /pusherapp\.com/,              label: "Real-time (Pusher)",                   confidence: "HIGH",   category: "realtime" },
  { pattern: /sockjs.*pusher/,              label: "Real-time (Pusher SockJS)",            confidence: "HIGH",   category: "realtime" },
  { pattern: /ws-.*\.pusher\.com/,          label: "Real-time (Pusher WebSocket)",         confidence: "HIGH",   category: "realtime" },
  { pattern: /pusher/i,                     label: "Real-time (Pusher)",                   confidence: "HIGH",   category: "realtime" },
  // Ably
  { pattern: /realtime\.ably\.io/,          label: "Real-time (Ably)",                     confidence: "HIGH",   category: "realtime" },
  { pattern: /rest\.ably\.io/,              label: "Real-time (Ably REST)",                confidence: "HIGH",   category: "realtime" },
  { pattern: /ably\.io/,                    label: "Real-time (Ably)",                     confidence: "HIGH",   category: "realtime" },
  { pattern: /ably\.net/,                   label: "Real-time (Ably)",                     confidence: "HIGH",   category: "realtime" },
  // Twilio
  { pattern: /twiliocdn\.com/,              label: "Messaging (Twilio CDN)",               confidence: "HIGH",   category: "realtime" },
  { pattern: /twilio\.com/,                 label: "Messaging (Twilio)",                   confidence: "HIGH",   category: "realtime" },
  // Vonage / Nexmo
  { pattern: /vonage\.com/,                 label: "Messaging (Vonage)",                   confidence: "HIGH",   category: "realtime" },
  { pattern: /nexmo\.com/,                  label: "Messaging (Vonage/Nexmo)",             confidence: "HIGH",   category: "realtime" },
  // LiveKit
  { pattern: /livekit\.cloud/,              label: "Real-time (LiveKit)",                  confidence: "HIGH",   category: "realtime" },
  { pattern: /livekit\.io/,                 label: "Real-time (LiveKit)",                  confidence: "HIGH",   category: "realtime" },
  // Daily.co
  { pattern: /daily\.co/,                   label: "Real-time (Daily.co)",                 confidence: "HIGH",   category: "realtime" },
  // Agora
  { pattern: /agora\.io/,                   label: "Real-time (Agora)",                    confidence: "HIGH",   category: "realtime" },
  { pattern: /sd-rtn\.com/,                 label: "Real-time (Agora CDN)",                confidence: "HIGH",   category: "realtime" },
  // Socket.io
  { pattern: /socket\.io/,                  label: "Real-time (Socket.io)",                confidence: "HIGH",   category: "realtime" },

  // ─── TAG MANAGEMENT (MEDIUM — GTM can load critical scripts) ──────────────
  { pattern: /googletagmanager\.com/,       label: "Tag Manager (GTM)",                    confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /tags\.tiqcdn\.com/,           label: "Tag Manager (Tealium)",                confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /tiqcdn\.com/,                 label: "Tag Manager (Tealium CDN)",            confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /tealium/i,                    label: "Tag Manager (Tealium)",                confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /assets\.adobedtm\.com/,       label: "Tag Manager (Adobe Launch CDN)",       confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /adobedtm\.com/,               label: "Tag Manager (Adobe Launch)",           confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /cdn\.segment\.com/,           label: "Data Pipeline (Segment CDN)",          confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /api\.segment\.io/,            label: "Data Pipeline (Segment API)",          confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /analytics\.js.*segment/,      label: "Data Pipeline (Segment analytics.js)", confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /segment\.(com|io)/,           label: "Data Pipeline (Segment)",              confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /cdn\.rudderlabs\.com/,        label: "Data Pipeline (RudderStack CDN)",      confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /rudderstack\.com/,            label: "Data Pipeline (RudderStack)",          confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /rudderlabs\.com/,             label: "Data Pipeline (RudderStack)",          confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /jssdks\.mparticle\.com/,      label: "Data Pipeline (mParticle CDN)",        confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /mparticle\.com/,              label: "Data Pipeline (mParticle)",            confidence: "MEDIUM", category: "tag-manager" },
  { pattern: /ensighten/i,                  label: "Tag Manager (Ensighten)",              confidence: "MEDIUM", category: "tag-manager" },

  // ─── CUSTOMER SUPPORT & CHAT (MEDIUM) ─────────────────────────────────────
  // Intercom
  { pattern: /js\.intercomcdn\.com/,        label: "Chat (Intercom CDN)",                  confidence: "MEDIUM", category: "chat" },
  { pattern: /widget\.intercom\.io/,        label: "Chat (Intercom widget)",               confidence: "MEDIUM", category: "chat" },
  { pattern: /intercom\.io/,                label: "Chat (Intercom)",                      confidence: "MEDIUM", category: "chat" },
  { pattern: /intercom/i,                   label: "Chat (Intercom)",                      confidence: "MEDIUM", category: "chat" },
  // Zendesk
  { pattern: /static\.zdassets\.com/,       label: "Support (Zendesk CDN)",                confidence: "MEDIUM", category: "chat" },
  { pattern: /zdassets\.com/,               label: "Support (Zendesk assets)",             confidence: "MEDIUM", category: "chat" },
  { pattern: /zendesk\.com/,                label: "Support (Zendesk)",                    confidence: "MEDIUM", category: "chat" },
  // Drift
  { pattern: /js\.driftt\.com/,             label: "Chat (Drift JS)",                      confidence: "MEDIUM", category: "chat" },
  { pattern: /driftt\.com/,                 label: "Chat (Drift CDN)",                     confidence: "MEDIUM", category: "chat" },
  { pattern: /drift\.com/,                  label: "Chat (Drift)",                         confidence: "MEDIUM", category: "chat" },
  // Freshchat / Freshdesk
  { pattern: /freshchat/i,                  label: "Chat (Freshchat)",                     confidence: "MEDIUM", category: "chat" },
  { pattern: /freshdesk/i,                  label: "Support (Freshdesk)",                  confidence: "MEDIUM", category: "chat" },
  { pattern: /freshworksapi\.com/,          label: "Chat (Freshworks API)",                confidence: "MEDIUM", category: "chat" },
  // LiveChat
  { pattern: /cdn\.livechatinc\.com/,       label: "Chat (LiveChat CDN)",                  confidence: "MEDIUM", category: "chat" },
  { pattern: /livechatinc\.com/,            label: "Chat (LiveChat)",                      confidence: "MEDIUM", category: "chat" },
  { pattern: /livechat/i,                   label: "Chat (LiveChat)",                      confidence: "MEDIUM", category: "chat" },
  // Crisp
  { pattern: /client\.crisp\.chat/,         label: "Chat (Crisp client)",                  confidence: "MEDIUM", category: "chat" },
  { pattern: /crisp\.chat/,                 label: "Chat (Crisp)",                         confidence: "MEDIUM", category: "chat" },
  // HubSpot
  { pattern: /hs-scripts\.com/,             label: "Chat/CRM (HubSpot scripts)",           confidence: "MEDIUM", category: "chat" },
  { pattern: /hsforms\.com/,                label: "CRM (HubSpot forms)",                  confidence: "MEDIUM", category: "chat" },
  { pattern: /hubspot\.com/,                label: "Chat/CRM (HubSpot)",                   confidence: "MEDIUM", category: "chat" },
  // Tidio
  { pattern: /code\.tidio\.co/,             label: "Chat (Tidio)",                         confidence: "MEDIUM", category: "chat" },
  { pattern: /tidio\.co/,                   label: "Chat (Tidio)",                         confidence: "MEDIUM", category: "chat" },
  // Kustomer
  { pattern: /cdn\.kustomerapp\.com/,       label: "Support (Kustomer CDN)",               confidence: "MEDIUM", category: "chat" },
  { pattern: /kustomerapp\.com/,            label: "Support (Kustomer)",                   confidence: "MEDIUM", category: "chat" },
  // Olark
  { pattern: /olark\.com/,                  label: "Chat (Olark)",                         confidence: "MEDIUM", category: "chat" },

  // ─── ERROR MONITORING (MEDIUM) ────────────────────────────────────────────
  // Sentry
  { pattern: /browser\.sentry-cdn\.com/,    label: "Error Tracking (Sentry CDN)",          confidence: "MEDIUM", category: "monitoring" },
  { pattern: /\.ingest\.sentry\.io/,        label: "Error Tracking (Sentry ingest)",       confidence: "MEDIUM", category: "monitoring" },
  { pattern: /sentry\.io/,                  label: "Error Tracking (Sentry)",              confidence: "MEDIUM", category: "monitoring" },
  // Bugsnag
  { pattern: /notify\.bugsnag\.com/,        label: "Error Tracking (Bugsnag notify)",      confidence: "MEDIUM", category: "monitoring" },
  { pattern: /sessions\.bugsnag\.com/,      label: "Error Tracking (Bugsnag sessions)",    confidence: "MEDIUM", category: "monitoring" },
  { pattern: /bugsnag/i,                    label: "Error Tracking (Bugsnag)",             confidence: "MEDIUM", category: "monitoring" },
  // Rollbar
  { pattern: /cdn\.rollbar\.com/,           label: "Error Tracking (Rollbar CDN)",         confidence: "MEDIUM", category: "monitoring" },
  { pattern: /api\.rollbar\.com/,           label: "Error Tracking (Rollbar API)",         confidence: "MEDIUM", category: "monitoring" },
  { pattern: /rollbar/i,                    label: "Error Tracking (Rollbar)",             confidence: "MEDIUM", category: "monitoring" },
  // Datadog RUM
  { pattern: /browser-intake-datadoghq\.com/, label: "Monitoring (Datadog RUM intake)",    confidence: "MEDIUM", category: "monitoring" },
  { pattern: /datadoghq\.com/,              label: "Monitoring (Datadog)",                 confidence: "MEDIUM", category: "monitoring" },
  { pattern: /datadoghq\.eu/,               label: "Monitoring (Datadog EU)",              confidence: "MEDIUM", category: "monitoring" },
  // New Relic
  { pattern: /js-agent\.newrelic\.com/,     label: "Monitoring (New Relic agent)",         confidence: "MEDIUM", category: "monitoring" },
  { pattern: /bam\.nr-data\.net/,           label: "Monitoring (New Relic BAM)",           confidence: "MEDIUM", category: "monitoring" },
  { pattern: /nr-data\.net/,                label: "Monitoring (New Relic data)",          confidence: "MEDIUM", category: "monitoring" },
  { pattern: /newrelic/i,                   label: "Monitoring (New Relic)",               confidence: "MEDIUM", category: "monitoring" },
  // Dynatrace
  { pattern: /\.live\.dynatrace\.com/,      label: "Monitoring (Dynatrace live)",          confidence: "MEDIUM", category: "monitoring" },
  { pattern: /dynatrace/i,                  label: "Monitoring (Dynatrace)",               confidence: "MEDIUM", category: "monitoring" },
  // AppDynamics
  { pattern: /eum-appdynamics\.com/,        label: "Monitoring (AppDynamics EUM)",         confidence: "MEDIUM", category: "monitoring" },
  { pattern: /appdynamics/i,                label: "Monitoring (AppDynamics)",             confidence: "MEDIUM", category: "monitoring" },
  // Raygun
  { pattern: /raygun\.com/,                 label: "Error Tracking (Raygun)",              confidence: "MEDIUM", category: "monitoring" },
  // Airbrake
  { pattern: /airbrake\.io/,                label: "Error Tracking (Airbrake)",            confidence: "MEDIUM", category: "monitoring" },

  // ─── SESSION REPLAY (MEDIUM) ──────────────────────────────────────────────
  // Hotjar
  { pattern: /static\.hotjar\.com/,         label: "Session Replay (Hotjar CDN)",          confidence: "MEDIUM", category: "session-replay" },
  { pattern: /insights\.hotjar\.com/,       label: "Session Replay (Hotjar insights)",     confidence: "MEDIUM", category: "session-replay" },
  { pattern: /hotjar/i,                     label: "Session Replay (Hotjar)",              confidence: "MEDIUM", category: "session-replay" },
  // FullStory
  { pattern: /rs\.fullstory\.com/,          label: "Session Replay (FullStory record)",    confidence: "MEDIUM", category: "session-replay" },
  { pattern: /edge\.fullstory\.com/,        label: "Session Replay (FullStory edge)",      confidence: "MEDIUM", category: "session-replay" },
  { pattern: /fullstory/i,                  label: "Session Replay (FullStory)",           confidence: "MEDIUM", category: "session-replay" },
  // LogRocket
  { pattern: /cdn\.logrocket\.io/,          label: "Session Replay (LogRocket CDN)",       confidence: "MEDIUM", category: "session-replay" },
  { pattern: /lr-in-prod\.com/,             label: "Session Replay (LogRocket ingest)",    confidence: "MEDIUM", category: "session-replay" },
  { pattern: /lr-in\.com/,                  label: "Session Replay (LogRocket ingest)",    confidence: "MEDIUM", category: "session-replay" },
  { pattern: /logrocket/i,                  label: "Session Replay (LogRocket)",           confidence: "MEDIUM", category: "session-replay" },
  // Mouseflow
  { pattern: /mouseflow/i,                  label: "Session Replay (Mouseflow)",           confidence: "MEDIUM", category: "session-replay" },
  // Lucky Orange
  { pattern: /luckyorange\.com/,            label: "Session Replay (Lucky Orange)",        confidence: "MEDIUM", category: "session-replay" },
  { pattern: /luckyorange\.net/,            label: "Session Replay (Lucky Orange CDN)",    confidence: "MEDIUM", category: "session-replay" },
  { pattern: /luckyorange/i,                label: "Session Replay (Lucky Orange)",        confidence: "MEDIUM", category: "session-replay" },
  // Inspectlet
  { pattern: /inspectlet/i,                 label: "Session Replay (Inspectlet)",          confidence: "MEDIUM", category: "session-replay" },
  // Microsoft Clarity
  { pattern: /clarity\.ms/,                 label: "Session Replay (Microsoft Clarity)",   confidence: "MEDIUM", category: "session-replay" },
  // Quantum Metric
  { pattern: /cdn\.quantummetric\.com/,     label: "Session Replay (Quantum Metric CDN)",  confidence: "MEDIUM", category: "session-replay" },
  { pattern: /quantummetric/i,              label: "Session Replay (Quantum Metric)",      confidence: "MEDIUM", category: "session-replay" },
  // Contentsquare
  { pattern: /cs-script\.net/,              label: "Session Replay (Contentsquare CDN)",   confidence: "MEDIUM", category: "session-replay" },
  { pattern: /contentsquare/i,              label: "Session Replay (Contentsquare)",       confidence: "MEDIUM", category: "session-replay" },
  // Glassbox
  { pattern: /glassboxdigital\.io/,         label: "Session Replay (Glassbox CDN)",        confidence: "MEDIUM", category: "session-replay" },
  { pattern: /glassbox\.com/,               label: "Session Replay (Glassbox)",            confidence: "MEDIUM", category: "session-replay" },
  // Medallia / Kampyle
  { pattern: /kampyle\.com/,                label: "Session Replay (Medallia/Kampyle)",    confidence: "MEDIUM", category: "session-replay" },
  { pattern: /medallia\.com/,               label: "Session Replay (Medallia)",            confidence: "MEDIUM", category: "session-replay" },

  // ─── CONSENT MANAGEMENT (MEDIUM — can block page init if CMP fails) ────────
  // OneTrust / CookieLaw
  { pattern: /cdn\.cookielaw\.org/,         label: "Consent (OneTrust CookieLaw CDN)",     confidence: "MEDIUM", category: "consent" },
  { pattern: /cookielaw\.org/,              label: "Consent (OneTrust CookieLaw)",         confidence: "MEDIUM", category: "consent" },
  { pattern: /geolocation\.onetrust\.com/,  label: "Consent (OneTrust Geo)",               confidence: "MEDIUM", category: "consent" },
  { pattern: /onetrust\.com/,               label: "Consent (OneTrust)",                   confidence: "MEDIUM", category: "consent" },
  // Cookiebot
  { pattern: /consent\.cookiebot\.com/,     label: "Consent (Cookiebot)",                  confidence: "MEDIUM", category: "consent" },
  { pattern: /consentcdn\.cookiebot\.com/,  label: "Consent (Cookiebot CDN)",              confidence: "MEDIUM", category: "consent" },
  { pattern: /cookiebot/i,                  label: "Consent (Cookiebot)",                  confidence: "MEDIUM", category: "consent" },
  // Usercentrics
  { pattern: /usercentrics\.eu/,            label: "Consent (Usercentrics EU)",            confidence: "MEDIUM", category: "consent" },
  { pattern: /usercentrics\.com/,           label: "Consent (Usercentrics)",               confidence: "MEDIUM", category: "consent" },
  { pattern: /cookiehub\.com/,              label: "Consent (Usercentrics CookieHub)",     confidence: "MEDIUM", category: "consent" },
  // TrustArc
  { pattern: /consent\.trustarc\.com/,      label: "Consent (TrustArc)",                   confidence: "MEDIUM", category: "consent" },
  { pattern: /trustarc\.com/,               label: "Consent (TrustArc)",                   confidence: "MEDIUM", category: "consent" },
  { pattern: /truste\.com/,                 label: "Consent (TrustArc/TRUSTe)",            confidence: "MEDIUM", category: "consent" },
  // Didomi
  { pattern: /didomi\.io/,                  label: "Consent (Didomi)",                     confidence: "MEDIUM", category: "consent" },
  { pattern: /privacy-center\.org/,         label: "Consent (Didomi Privacy Center)",      confidence: "MEDIUM", category: "consent" },
  // Osano
  { pattern: /osano\.com/,                  label: "Consent (Osano)",                      confidence: "MEDIUM", category: "consent" },
  // iubenda
  { pattern: /cdn\.iubenda\.com/,           label: "Consent (iubenda CDN)",                confidence: "MEDIUM", category: "consent" },
  { pattern: /cs\.iubenda\.com/,            label: "Consent (iubenda CS)",                 confidence: "MEDIUM", category: "consent" },
  { pattern: /iubenda\.com/,                label: "Consent (iubenda)",                    confidence: "MEDIUM", category: "consent" },
  // Termly
  { pattern: /app\.termly\.io/,             label: "Consent (Termly)",                     confidence: "MEDIUM", category: "consent" },
  { pattern: /termly\.io/,                  label: "Consent (Termly)",                     confidence: "MEDIUM", category: "consent" },
  // Quantcast (also consent mgmt)
  { pattern: /quantcast/i,                  label: "Consent (Quantcast Choice)",           confidence: "MEDIUM", category: "consent" },

  // ─── PURE ANALYTICS (LOW) ─────────────────────────────────────────────────
  // Google Analytics 4
  { pattern: /region1\.analytics\.google\.com/, label: "Analytics (GA4 region1)",          confidence: "LOW",    category: "analytics" },
  { pattern: /region1\.google-analytics\.com/,  label: "Analytics (GA4 region1 alt)",      confidence: "LOW",    category: "analytics" },
  { pattern: /analytics\.google\.com/,      label: "Analytics (Google Analytics)",         confidence: "LOW",    category: "analytics" },
  { pattern: /www\.google-analytics\.com/,  label: "Analytics (Google Analytics)",         confidence: "LOW",    category: "analytics" },
  { pattern: /google-analytics/i,           label: "Analytics (Google Analytics)",         confidence: "LOW",    category: "analytics" },
  // Mixpanel
  { pattern: /api\.mixpanel\.com/,          label: "Analytics (Mixpanel API)",             confidence: "LOW",    category: "analytics" },
  { pattern: /cdn\.mxpnl\.com/,             label: "Analytics (Mixpanel CDN)",             confidence: "LOW",    category: "analytics" },
  { pattern: /mixpanel/i,                   label: "Analytics (Mixpanel)",                 confidence: "LOW",    category: "analytics" },
  // Amplitude
  { pattern: /api\.amplitude\.com/,         label: "Analytics (Amplitude API)",            confidence: "LOW",    category: "analytics" },
  { pattern: /api2\.amplitude\.com/,        label: "Analytics (Amplitude API v2)",         confidence: "LOW",    category: "analytics" },
  { pattern: /cdn\.amplitude\.com/,         label: "Analytics (Amplitude CDN)",            confidence: "LOW",    category: "analytics" },
  { pattern: /amplitude\.com/,              label: "Analytics (Amplitude)",                confidence: "LOW",    category: "analytics" },
  // Heap
  { pattern: /cdn\.heapanalytics\.com/,     label: "Analytics (Heap CDN)",                 confidence: "LOW",    category: "analytics" },
  { pattern: /heapanalytics\.com/,          label: "Analytics (Heap)",                     confidence: "LOW",    category: "analytics" },
  { pattern: /heap\.io/,                    label: "Analytics (Heap)",                     confidence: "LOW",    category: "analytics" },
  // Pendo
  { pattern: /cdn\.pendo\.io/,              label: "Analytics (Pendo CDN)",                confidence: "LOW",    category: "analytics" },
  { pattern: /data\.pendo\.io/,             label: "Analytics (Pendo data)",               confidence: "LOW",    category: "analytics" },
  { pattern: /app\.pendo\.io/,              label: "Analytics (Pendo app)",                confidence: "LOW",    category: "analytics" },
  { pattern: /pendo\.io/,                   label: "Analytics (Pendo)",                    confidence: "LOW",    category: "analytics" },
  // Chartbeat
  { pattern: /static\.chartbeat\.com/,      label: "Analytics (Chartbeat CDN)",            confidence: "LOW",    category: "analytics" },
  { pattern: /chartbeat/i,                  label: "Analytics (Chartbeat)",                confidence: "LOW",    category: "analytics" },
  // Comscore
  { pattern: /scorecardresearch\.com/,      label: "Analytics (Comscore)",                 confidence: "LOW",    category: "analytics" },
  { pattern: /comscore/i,                   label: "Analytics (Comscore)",                 confidence: "LOW",    category: "analytics" },
  // Parse.ly
  { pattern: /parsely\.com/,                label: "Analytics (Parse.ly)",                 confidence: "LOW",    category: "analytics" },
  // Piano Analytics / AT Internet
  { pattern: /piano\.io/,                   label: "Analytics (Piano Analytics)",          confidence: "LOW",    category: "analytics" },
  { pattern: /atinternet-solutions\.com/,   label: "Analytics (AT Internet)",              confidence: "LOW",    category: "analytics" },
  { pattern: /ati-host\.net/,               label: "Analytics (AT Internet CDN)",          confidence: "LOW",    category: "analytics" },
  // Woopra
  { pattern: /woopra\.com/,                 label: "Analytics (Woopra)",                   confidence: "LOW",    category: "analytics" },
  // Countly
  { pattern: /count\.ly/,                   label: "Analytics (Countly)",                  confidence: "LOW",    category: "analytics" },
  // Other analytics
  { pattern: /kissmetrics/i,                label: "Analytics (Kissmetrics)",              confidence: "LOW",    category: "analytics" },
  { pattern: /clicky\.com/,                 label: "Analytics (Clicky)",                   confidence: "LOW",    category: "analytics" },
  { pattern: /statcounter/i,                label: "Analytics (StatCounter)",              confidence: "LOW",    category: "analytics" },
  { pattern: /plausible\.io/,               label: "Analytics (Plausible)",                confidence: "LOW",    category: "analytics" },
  { pattern: /fathom/i,                     label: "Analytics (Fathom)",                   confidence: "LOW",    category: "analytics" },

  // ─── ADVERTISING (LOW — never breaks functionality) ───────────────────────
  // Google Ads / DoubleClick
  { pattern: /googleadservices\.com/,       label: "Ads (Google Ads)",                     confidence: "LOW",    category: "advertising" },
  { pattern: /googlesyndication\.com/,      label: "Ads (Google AdSense)",                 confidence: "LOW",    category: "advertising" },
  { pattern: /doubleclick\.net/,            label: "Ads (Google DoubleClick)",             confidence: "LOW",    category: "advertising" },
  // Meta / Facebook
  { pattern: /connect\.facebook\.net/,      label: "Ads (Meta/Facebook Pixel)",            confidence: "LOW",    category: "advertising" },
  { pattern: /facebook\.net/,               label: "Ads (Facebook)",                       confidence: "LOW",    category: "advertising" },
  // LinkedIn
  { pattern: /px\.ads\.linkedin\.com/,      label: "Ads (LinkedIn Insight pixel)",         confidence: "LOW",    category: "advertising" },
  { pattern: /snap\.licdn\.com/,            label: "Ads (LinkedIn Insight CDN)",           confidence: "LOW",    category: "advertising" },
  { pattern: /ads\.linkedin\.com/,          label: "Ads (LinkedIn Ads)",                   confidence: "LOW",    category: "advertising" },
  // Twitter / X
  { pattern: /analytics\.twitter\.com/,     label: "Ads (Twitter/X Analytics)",            confidence: "LOW",    category: "advertising" },
  { pattern: /static\.ads-twitter\.com/,    label: "Ads (Twitter/X Ads pixel)",            confidence: "LOW",    category: "advertising" },
  { pattern: /twitter\.com\/i\/adsct/,      label: "Ads (Twitter/X conversion)",           confidence: "LOW",    category: "advertising" },
  // TikTok
  { pattern: /analytics\.tiktok\.com/,      label: "Ads (TikTok Analytics)",               confidence: "LOW",    category: "advertising" },
  { pattern: /business-api\.tiktok\.com/,   label: "Ads (TikTok Business API)",            confidence: "LOW",    category: "advertising" },
  // Criteo
  { pattern: /criteo\.net/,                 label: "Ads (Criteo)",                         confidence: "LOW",    category: "advertising" },
  { pattern: /criteo\.com/,                 label: "Ads (Criteo)",                         confidence: "LOW",    category: "advertising" },
  // AdRoll
  { pattern: /d\.adroll\.com/,              label: "Ads (AdRoll)",                         confidence: "LOW",    category: "advertising" },
  { pattern: /adroll/i,                     label: "Ads (AdRoll)",                         confidence: "LOW",    category: "advertising" },
  // Trade Desk
  { pattern: /adsrvr\.org/,                 label: "Ads (The Trade Desk)",                 confidence: "LOW",    category: "advertising" },
  // AppNexus / Xandr
  { pattern: /adnxs\.com/,                  label: "Ads (Xandr/AppNexus)",                 confidence: "LOW",    category: "advertising" },
  // Rubicon / Magnite
  { pattern: /rubiconproject\.com/,         label: "Ads (Magnite/Rubicon)",                confidence: "LOW",    category: "advertising" },
  // PubMatic
  { pattern: /pubmatic\.com/,               label: "Ads (PubMatic)",                       confidence: "LOW",    category: "advertising" },
  // OpenX
  { pattern: /openx\.net/,                  label: "Ads (OpenX)",                          confidence: "LOW",    category: "advertising" },
  { pattern: /openx\.com/,                  label: "Ads (OpenX)",                          confidence: "LOW",    category: "advertising" },
  // Index Exchange / Casale
  { pattern: /indexexchange\.com/,          label: "Ads (Index Exchange)",                 confidence: "LOW",    category: "advertising" },
  { pattern: /casalemedia\.com/,            label: "Ads (Casale/Index Exchange)",          confidence: "LOW",    category: "advertising" },
  // Taboola
  { pattern: /cdn\.taboola\.com/,           label: "Ads (Taboola CDN)",                    confidence: "LOW",    category: "advertising" },
  { pattern: /taboola/i,                    label: "Ads (Taboola)",                        confidence: "LOW",    category: "advertising" },
  // Outbrain
  { pattern: /outbrain/i,                   label: "Ads (Outbrain)",                       confidence: "LOW",    category: "advertising" },
  // Pinterest
  { pattern: /ct\.pinterest\.com/,          label: "Ads (Pinterest Tag)",                  confidence: "LOW",    category: "advertising" },
  { pattern: /pintrk/,                      label: "Ads (Pinterest pixel)",                confidence: "LOW",    category: "advertising" },
  // Snapchat
  { pattern: /sc-static\.net/,              label: "Ads (Snapchat pixel CDN)",             confidence: "LOW",    category: "advertising" },
  { pattern: /snap\.com\/ads/,              label: "Ads (Snapchat Ads)",                   confidence: "LOW",    category: "advertising" },
  // Reddit
  { pattern: /alb\.reddit\.com/,            label: "Ads (Reddit pixel)",                   confidence: "LOW",    category: "advertising" },
  // Microsoft UET
  { pattern: /bat\.bing\.com/,              label: "Ads (Microsoft UET/Bing pixel)",       confidence: "LOW",    category: "advertising" },
  { pattern: /uet\.bing\.com/,              label: "Ads (Microsoft UET)",                  confidence: "LOW",    category: "advertising" },
];

const NEXTDNS_ERRORS = [
  "net::ERR_NAME_NOT_RESOLVED",
  "net::ERR_CERT_AUTHORITY_INVALID",
  "net::ERR_BLOCKED_BY_ADMINISTRATOR",
  "net::ERR_BLOCKED_BY_CLIENT",
  "net::ERR_FAILED",
];

function classifyDomain(hostname) {
  for (const entry of DOMAIN_DB) {
    if (entry.pattern.test(hostname)) {
      return {
        label: entry.label,
        confidence: entry.confidence,
        category: entry.category,
        functionalImpact: entry.functionalImpact || null,
        known: true,
      };
    }
  }
  return {
    label: "Unknown Domain",
    confidence: "MEDIUM",
    category: "unknown",
    known: false,
  };
}

function isLikelyNextDNSBlock(error) {
  return NEXTDNS_ERRORS.some(e => error.includes(e));
}

// Export for use in background.js and popup.js
if (typeof module !== "undefined") {
  module.exports = { classifyDomain, isLikelyNextDNSBlock, DOMAIN_DB };
}

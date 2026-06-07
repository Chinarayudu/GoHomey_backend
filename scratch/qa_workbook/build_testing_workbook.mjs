import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/Users/dussa/homey_backend/outputs";
const outputPath = `${outputDir}/Homey_Testing_Team_Flow_and_Checklist_v2.xlsx`;

const workbook = Workbook.create();

const theme = {
  navy: "#16324F",
  blue: "#2563EB",
  teal: "#0F766E",
  green: "#16A34A",
  amber: "#F59E0B",
  red: "#DC2626",
  gray: "#6B7280",
  lightBlue: "#EAF2FF",
  lightGreen: "#ECFDF5",
  lightAmber: "#FFF7ED",
  lightRed: "#FEF2F2",
  border: "#D9E2EC",
  headerText: "#FFFFFF",
};

function colLetter(n) {
  let s = "";
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - m) / 26);
  }
  return s;
}

function addSheet(name, title, subtitle) {
  const sheet = workbook.worksheets.add(name);
  sheet.showGridLines = false;
  sheet.getRange("A1:H1").merge();
  sheet.getRange("A1").values = [[title]];
  sheet.getRange("A1").format = {
    fill: theme.navy,
    font: { bold: true, color: theme.headerText, size: 16 },
    horizontalAlignment: "left",
    verticalAlignment: "middle",
  };
  sheet.getRange("A1").format.rowHeightPx = 34;
  if (subtitle) {
    sheet.getRange("A2:H2").merge();
    sheet.getRange("A2").values = [[subtitle]];
    sheet.getRange("A2").format = {
      fill: theme.lightBlue,
      font: { color: "#1F2937" },
      wrapText: true,
      verticalAlignment: "middle",
    };
    sheet.getRange("A2").format.rowHeightPx = 36;
  }
  return sheet;
}

function writeTable(sheet, startCell, headers, rows, tableName, widths = []) {
  const [col, rowText] = startCell.match(/[A-Z]+|\d+/g);
  const startRow = Number(rowText);
  const startCol = col.split("").reduce((acc, ch) => acc * 26 + ch.charCodeAt(0) - 64, 0);
  const range = `${startCell}:${colLetter(startCol + headers.length - 1)}${startRow + rows.length}`;
  sheet.getRange(range).values = [headers, ...rows];
  sheet.getRange(`${startCell}:${colLetter(startCol + headers.length - 1)}${startRow}`).format = {
    fill: theme.teal,
    font: { bold: true, color: theme.headerText },
    wrapText: true,
    verticalAlignment: "middle",
  };
  sheet.getRange(range).format = {
    borders: { preset: "all", style: "thin", color: theme.border },
    wrapText: true,
    verticalAlignment: "top",
  };
  sheet.getRange(`${startCell}:${colLetter(startCol + headers.length - 1)}${startRow}`).format = {
    fill: theme.teal,
    font: { bold: true, color: theme.headerText },
    borders: { preset: "all", style: "thin", color: theme.border },
    wrapText: true,
    verticalAlignment: "middle",
  };
  try {
    const table = sheet.tables.add(range, true, tableName);
    table.showFilterButton = true;
    table.style = "TableStyleMedium2";
  } catch {}
  widths.forEach((width, index) => {
    if (width) sheet.getRange(`${colLetter(startCol + index)}:${colLetter(startCol + index)}`).format.columnWidthPx = width;
  });
  sheet.freezePanes.freezeRows(startRow);
  return range;
}

function addStatusValidation(sheet, range) {
  sheet.getRange(range).dataValidation = {
    rule: { type: "list", values: ["Not Started", "In Progress", "Blocked", "Pass", "Fail", "N/A"] },
  };
  sheet.getRange(range).conditionalFormats.add("containsText", {
    text: "Pass",
    format: { fill: theme.lightGreen, font: { color: "#166534", bold: true } },
  });
  sheet.getRange(range).conditionalFormats.add("containsText", {
    text: "Fail",
    format: { fill: theme.lightRed, font: { color: "#991B1B", bold: true } },
  });
  sheet.getRange(range).conditionalFormats.add("containsText", {
    text: "Blocked",
    format: { fill: theme.lightAmber, font: { color: "#92400E", bold: true } },
  });
}

const start = addSheet(
  "Start Here",
  "Homey Backend QA Handoff",
  "Use this workbook as the testing team checklist for the backend API and connected app flows. Sensitive keys are intentionally excluded; request values through the approved secure channel."
);
start.getRange("A4:B13").values = [
  ["Project", "Homey backend"],
  ["API Prefix", "/api/v1"],
  ["Health Check", "GET /api/v1/health"],
  ["Swagger Docs", "GET /api/v1/docs"],
  ["Local Port", "3000 unless changed by PORT"],
  ["Primary Roles", "USER, CHEF, ADMIN"],
  ["Payment Gateway", "Razorpay test mode"],
  ["Delivery Provider", "Shadowfax testing mode; Borzo legacy webhook remains available"],
  ["Uploads", "Chef documents, meals, pantry/social images, batch proof, fuel weigh-in proof"],
  ["Prepared For", "QA / Testing Team"],
];
start.getRange("A4:A13").format = { fill: theme.lightBlue, font: { bold: true } };
start.getRange("A4:B13").format = { borders: { preset: "all", style: "thin", color: theme.border }, wrapText: true };
start.getRange("A:A").format.columnWidthPx = 170;
start.getRange("B:B").format.columnWidthPx = 620;

start.getRange("A16:H16").values = [["Execution Summary", "Total Cases", "Not Started", "In Progress", "Blocked", "Passed", "Failed", "N/A"]];
start.getRange("A16:H16").format = { fill: theme.teal, font: { bold: true, color: theme.headerText }, borders: { preset: "all", style: "thin", color: theme.border } };
start.getRange("A17:H17").values = [["Current QA Cycle", null, null, null, null, null, null, null]];
start.getRange("B17:H17").formulas = [[
  "=COUNTA('Test Cases'!A5:A200)",
  "=COUNTIF('Test Cases'!I5:I200,\"Not Started\")",
  "=COUNTIF('Test Cases'!I5:I200,\"In Progress\")",
  "=COUNTIF('Test Cases'!I5:I200,\"Blocked\")",
  "=COUNTIF('Test Cases'!I5:I200,\"Pass\")",
  "=COUNTIF('Test Cases'!I5:I200,\"Fail\")",
  "=COUNTIF('Test Cases'!I5:I200,\"N/A\")",
]];
start.getRange("A17:H17").format = { borders: { preset: "all", style: "thin", color: theme.border }, font: { bold: true } };

const envRows = [
  ["Server", "Node.js version", "Node 20.19+, 22.12+, or 24+", "Needed before running the backend", "Do not mix old Node versions during testing"],
  ["Server", "Install/build/run", "npm install, npm run build, npm run start:dev", "Start backend and confirm health endpoint", "Development script uses TypeScript runtime"],
  ["Database", "DATABASE_URL", "PostgreSQL connection string", "Seed/read/write users, chefs, orders, payments, fuel data", "Secret value must be requested securely"],
  ["Auth", "JWT_SECRET", "Token signing secret", "Login and protected routes", "Must match server environment"],
  ["Cache/Queue", "REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD, REDIS_TLS", "Redis/Upstash settings", "Fuel scheduler and queue-related behavior", "Keep secrets out of tickets"],
  ["OTP", "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER", "Twilio test/sandbox details", "OTP send and verify flows", "QA needs test phone numbers and OTP access"],
  ["Payment", "RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET", "Razorpay test mode credentials", "Create, verify, webhook tests", "Use Razorpay test cards/UPI only"],
  ["Pricing", "HOMEY_PLATFORM_FEE_RUPEES", "Platform fee value", "Payment amount validation", "Confirm amount includes platform fee"],
  ["Uploads", "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_URL", "Cloudinary upload config", "Chef docs, meal images, pantry/social images, proof uploads", "Verify returned URLs open"],
  ["Delivery", "SHADOWFAX_API_MODE, SHADOWFAX_API_TOKEN, SHADOWFAX_CREDITS_KEY, SHADOWFAX_CLIENT_CODE", "Shadowfax testing integration", "Dispatch and webhook delivery status", "Testing mode expected"],
  ["Delivery Legacy", "BORZO_API_TOKEN, BORZO_BASE_URL, BORZO_WEBHOOK_SECRET", "Borzo legacy integration", "Legacy webhook regression only", "Use if Borzo support remains in scope"],
  ["Fuel", "FUEL_SCHEDULER_ENABLED", "Enable/disable fuel scheduler", "Fuel fulfillment generation and reminders", "Agree whether scheduled jobs should run during QA"],
];
const env = addSheet("Environment", "Environment and Access Requirements", "Use this tab to prepare the QA environment without exposing secret values.");
writeTable(env, "A4", ["Area", "Requirement", "What QA Needs", "Used For", "Notes"], envRows, "EnvironmentRequirements", [130, 260, 290, 300, 320]);

const dataRows = [
  ["USER", "Normal customer", "Registered user with token", "Browse chefs/meals, add address, order, pay, follow chef", "email, phone, password, token, address id"],
  ["CHEF Applicant", "Chef not yet approved", "User token after OTP/register; registration step 1-3 incomplete/completed", "Chef registration and status checks", "government_id, food_safety_cert, kitchen_photo sample files"],
  ["CHEF Approved", "Verified chef", "Chef with application APPROVED and is_verified true", "Meal/pantry/social/fuel slot creation, chef orders, proof upload", "chef id, user id, token"],
  ["ADMIN", "Admin user", "Admin token", "Approve chefs, admin stats, delivery dispatch, plan creation", "admin email/password/token"],
  ["Meal", "Daily meal", "Approved chef has meal with slots_remaining > 0", "Browse, order, payment, delivery", "meal id, price, service window, date"],
  ["Pantry Item", "Inventory item", "Approved chef has pantry inventory > 0", "Pantry browse/order and inventory checks", "item id, inventory, delivery window"],
  ["Social Event", "Bookable event", "Approved chef has event with slots_remaining > 0", "Social event booking and chef dashboard", "event id, date/end_date"],
  ["Address", "Customer delivery address", "At least one default and one non-default address", "Checkout delivery_address_id and location matching", "lat/lng inside serviceable radius"],
  ["Fuel Plan", "Admin-created plan", "Plan with delivery_time_slots and menu_json", "Fuel subscriptions, chef slots, Fuel NOW", "plan id, assigned chef id, time slot"],
  ["Order", "Paid and unpaid orders", "Orders in PENDING, PREPARING, READY_FOR_PICKUP, DELIVERED", "Status transitions, admin and chef dashboards", "order id, order type"],
  ["Payment", "Razorpay test payment", "Created Razorpay order and test payment response", "Verify and webhook tests", "razorpay_order_id, payment_id, signature"],
  ["Delivery", "Delivery record", "Order ready for pickup with delivery row", "Shadowfax dispatch, active deliveries, webhook mapping", "delivery id, external tracking id"],
  ["Files", "Upload samples", "Small jpeg/png/pdf files under accepted limits", "Multipart upload tests", "Include invalid extension and missing-file negative samples"],
];
const data = addSheet("Test Data", "Test Data Needed", "Create or request these records before a full QA pass.");
writeTable(data, "A4", ["Actor/Data", "Purpose", "Required State", "Where Used", "Fields to Capture"], dataRows, "TestDataNeeded", [150, 210, 340, 330, 310]);

const flowRows = [
  ["F01", "Auth and profile", "USER/CHEF/ADMIN", "Clean phone/email or existing test accounts", "Register/email login, send OTP, verify OTP, fetch profile", "Token returned, role correct, profile available, invalid credentials rejected", "/auth/register; /auth/login; /auth/send-otp; /auth/verify-otp; /auth/profile", "P0", "Not Started"],
  ["F02", "Customer address and location", "USER", "Logged-in user", "Create address, list addresses, update location, edit/delete address", "Address appears in list, default behavior sane, location match returned within 100m", "/users/addresses; /users/location", "P0", "Not Started"],
  ["F03", "Chef onboarding", "CHEF Applicant + ADMIN", "User token and sample docs", "Complete registration step 1, step 2, step 3 upload, check status, approve as admin", "Registration step increments, docs uploaded, application status changes to APPROVED", "/chefs/register/*; /admin/chefs; /admin/chefs/:id/application", "P0", "Not Started"],
  ["F04", "Chef catalog setup", "CHEF Approved", "Approved chef token", "Create meal with image, upload batch proof, create pantry item, create social event", "Catalog entries visible to users, uploads return public URLs", "/meals; /pantry; /social", "P0", "Not Started"],
  ["F05", "Browse and checkout", "USER", "Approved chef with meal/pantry/social/fuel items", "Browse chefs and items, checkout cart grouped by chef, create single-item orders", "Orders created with correct type, quantity, price, address and slots/inventory reduced", "/chefs; /meals; /orders/*", "P0", "Not Started"],
  ["F06", "Razorpay payment", "USER", "Pending order", "Create payment, verify payment, check payment status, simulate webhook", "Amount includes platform fee, payment completed, order/payment statuses updated", "/payments/create; /payments/verify; /payments/orders/:orderId; /payments/webhook/razorpay", "P0", "Not Started"],
  ["F07", "Chef fulfillment", "CHEF Approved", "Paid/confirmed order for chef", "Chef lists orders and moves status through confirmed/preparing/ready", "Only chef/admin can update; invalid status rejected; admin sees order state", "/orders/chef; /orders/:id/status; /admin/orders", "P0", "Not Started"],
  ["F08", "Delivery dispatch", "ADMIN", "Order READY_FOR_PICKUP", "List ready orders, dispatch to Shadowfax, inspect active delivery, process status webhook", "Tracking details stored, status maps to assigned/picked/delivered/failed", "/admin/orders/ready; /admin/deliveries/dispatch-shadowfax; /delivery/active; /webhooks/shadowfax", "P0", "Not Started"],
  ["F09", "Subscriptions", "ADMIN/CHEF/USER", "Plan created by admin, chef slot created", "Upload custom diet PDF, create plan, list plans, create chef slots, view plan/slots", "Plan/slot visibility and validations work", "/subscriptions/*", "P1", "Not Started"],
  ["F10", "Fuel subscription", "ADMIN/CHEF/USER", "Fuel plan and chef slot exist", "Create plan, enable chef, user subscribes, pause subscription, generate fulfillments, update status", "Subscription active/paused correctly; fulfillments generated and status transitions valid", "/fuel/plans; /fuel/chef/slots; /fuel/subscriptions; /fuel/fulfillments/*", "P0", "Not Started"],
  ["F11", "Fuel NOW", "USER/CHEF", "Chef stream token, user coordinates", "Find nearby chefs, open chef stream, start dispatch, chef accepts/rejects, user polls session", "Session state updates; missing lat/lng rejected; unauthorized chef rejected", "/fuel/now/chefs; /fuel/now/chef-stream; /fuel/now/dispatch", "P1", "Not Started"],
  ["F12", "Follow, feed, notification token", "USER", "Approved chef with content", "Follow chef, check following, view feed, unfollow, register device token", "Feed contains followed chef content within radius; duplicate token handled", "/follows/*; /feed; /notifications/device-token", "P1", "Not Started"],
  ["F13", "Admin dashboard/reporting", "ADMIN", "Seeded platform data", "Stats, top chefs, daily revenue, orders, users, chef detail filters", "Admin endpoints require admin role and return accurate totals/lists", "/admin/stats; /admin/top-chefs; /admin/revenue/daily; /admin/*", "P1", "Not Started"],
];
const flows = addSheet("E2E Flows", "End-to-End Business Flows", "Run P0 flows first, then P1 regressions. Update the Status column during each QA cycle.");
writeTable(flows, "A4", ["Flow ID", "Flow", "Actors", "Preconditions", "Main Steps", "Expected Result", "Primary APIs", "Priority", "Status"], flowRows, "EndToEndFlows", [80, 200, 150, 280, 390, 390, 360, 80, 130]);
addStatusValidation(flows, "I5:I100");

const testCases = [
  ["TC-001", "Auth", "Register customer with valid details", "Submit unique name, phone, email, password", "Unique email/phone", "201 and user created with USER role by default", "P0", "Positive", "Not Started", "", ""],
  ["TC-002", "Auth", "Reject duplicate email or phone", "Register using existing email/phone", "Existing account data", "Validation/conflict error; no duplicate user", "P0", "Negative", "Not Started", "", ""],
  ["TC-003", "Auth", "Login with email/password", "POST login and store token", "Known user credentials", "200 with token and user role", "P0", "Positive", "Not Started", "", ""],
  ["TC-004", "Auth", "Reject wrong password", "POST login with wrong password", "Known email", "401 invalid credentials", "P0", "Negative", "Not Started", "", ""],
  ["TC-005", "Auth", "OTP send and verify new/existing user", "Send OTP, verify OTP", "QA phone with OTP access", "Response indicates isNewUser/isChef/registration status correctly", "P0", "Integration", "Not Started", "", ""],
  ["TC-006", "Auth", "Protected profile requires token", "GET profile without token, then with token", "Valid token", "401 without token; 200 with profile using token", "P0", "Security", "Not Started", "", ""],
  ["TC-007", "Users", "Create delivery address", "POST address with required fields", "User token", "201 and address id returned", "P0", "Positive", "Not Started", "", ""],
  ["TC-008", "Users", "Reject incomplete address", "POST address missing city/state/zip", "User token", "400 validation error", "P0", "Negative", "Not Started", "", ""],
  ["TC-009", "Users", "Update location and match saved address", "PATCH location near saved address", "Address with lat/lng", "Response includes updated user and matchedAddress", "P1", "Positive", "Not Started", "", ""],
  ["TC-010", "Chef Onboarding", "Complete chef registration step 1", "POST step-1 personal info", "Authenticated applicant", "201 and registration moves to step 2", "P0", "Positive", "Not Started", "", ""],
  ["TC-011", "Chef Onboarding", "Reject step 2 before step 1", "POST step-2 for user without step-1", "Fresh user", "400 validation/business error", "P0", "Negative", "Not Started", "", ""],
  ["TC-012", "Chef Onboarding", "Complete chef registration step 2", "POST kitchen details with lat/lng/appliances", "Step 1 completed", "200 and registration moves to step 3", "P0", "Positive", "Not Started", "", ""],
  ["TC-013", "Chef Onboarding", "Upload all required chef documents", "Multipart POST step-3 with 3 files", "Step 2 completed; pdf/jpg/png samples", "200, document URLs stored, status PENDING_REVIEW", "P0", "Upload", "Not Started", "", ""],
  ["TC-014", "Chef Onboarding", "Reject missing chef document", "Omit one required file", "Step 2 completed", "400 with message listing required documents", "P0", "Negative", "Not Started", "", ""],
  ["TC-015", "Admin Chef", "Approve chef application", "Admin PATCH chef application to APPROVED/isVerified true", "Admin token, pending chef id", "Chef can access chef-only features", "P0", "Positive", "Not Started", "", ""],
  ["TC-016", "Admin Chef", "Non-admin cannot approve chef", "Call admin/chef approval with user token", "User token", "403 forbidden", "P0", "Security", "Not Started", "", ""],
  ["TC-017", "Meals", "Chef creates meal with image", "Multipart POST meal", "Approved chef token", "201, image_url public, slots_remaining initialized", "P0", "Upload", "Not Started", "", ""],
  ["TC-018", "Meals", "User lists meals with filters", "GET meals by date/chef/location", "Published meal", "200 filtered list; optional radius applied", "P0", "Positive", "Not Started", "", ""],
  ["TC-019", "Meals", "Reject meal creation by normal user", "POST meal with user token", "User token", "403 forbidden", "P0", "Security", "Not Started", "", ""],
  ["TC-020", "Meals", "Chef uploads batch proof", "POST /meals/:id/proof with batch_proof", "Chef owns meal", "200 and batch_photo_url stored", "P1", "Upload", "Not Started", "", ""],
  ["TC-021", "Pantry", "Chef creates pantry item", "POST pantry with image/name/category/price/inventory", "Approved chef token", "201 item visible in list", "P1", "Positive", "Not Started", "", ""],
  ["TC-022", "Pantry", "Reject pantry order above inventory", "Create order quantity greater than inventory", "Pantry item with low inventory", "Error and inventory unchanged", "P1", "Negative", "Not Started", "", ""],
  ["TC-023", "Social", "Chef creates social event", "POST social event with image", "Approved chef token", "201 event visible to users", "P1", "Positive", "Not Started", "", ""],
  ["TC-024", "Social", "Book social event", "POST social order", "Event with slots available", "201 order created and event slots reduced", "P1", "Positive", "Not Started", "", ""],
  ["TC-025", "Orders", "Create meal order", "POST /orders/meal", "User token, meal id, address id", "201 order with DAILY_MEAL type and correct total", "P0", "Positive", "Not Started", "", ""],
  ["TC-026", "Orders", "Checkout mixed cart", "POST /orders/checkout with meal, pantry, social/fuel items", "Items across one or more chefs", "Orders grouped by chef and item quantities captured", "P0", "Positive", "Not Started", "", ""],
  ["TC-027", "Orders", "Reject checkout with invalid item type/id", "POST checkout with bad item", "User token", "400/404 error; no partial incorrect records", "P0", "Negative", "Not Started", "", ""],
  ["TC-028", "Orders", "User sees own orders", "GET /orders/user", "User has orders", "Only current user's orders returned", "P0", "Security", "Not Started", "", ""],
  ["TC-029", "Orders", "Chef sees active/completed orders", "GET /orders/chef?statusGroup=active/completed", "Chef has orders", "Response grouped/filtered as expected", "P0", "Positive", "Not Started", "", ""],
  ["TC-030", "Orders", "Valid order status transition", "PATCH order status through CONFIRMED/PREPARING/READY_FOR_PICKUP", "Chef/admin token", "Status updated and visible to admin/user", "P0", "Positive", "Not Started", "", ""],
  ["TC-031", "Orders", "Reject invalid order status", "PATCH status with unsupported value", "Chef/admin token", "400 validation error", "P0", "Negative", "Not Started", "", ""],
  ["TC-032", "Payments", "Create Razorpay payment", "POST /payments/create", "Pending order", "Razorpay order id returned; backend amount includes platform fee", "P0", "Integration", "Not Started", "", ""],
  ["TC-033", "Payments", "Verify Razorpay payment success", "POST verify with valid gateway values", "Razorpay test payment", "Payment COMPLETED and order payment reflected", "P0", "Integration", "Not Started", "", ""],
  ["TC-034", "Payments", "Reject invalid signature", "POST verify/webhook with bad signature", "Payment payload", "401/400 or failed verification; no false completion", "P0", "Security", "Not Started", "", ""],
  ["TC-035", "Payments", "Read payment by order", "GET /payments/orders/:orderId", "Paid and unpaid orders", "Correct status/amount returned", "P1", "Positive", "Not Started", "", ""],
  ["TC-036", "Delivery", "Admin lists ready orders", "GET /admin/orders/ready", "Order READY_FOR_PICKUP", "Ready order appears with enough dispatch info", "P0", "Positive", "Not Started", "", ""],
  ["TC-037", "Delivery", "Dispatch ready orders to Shadowfax", "POST /admin/deliveries/dispatch-shadowfax", "Shadowfax test config, ready order", "Per-order dispatch result and tracking saved", "P0", "Integration", "Not Started", "", ""],
  ["TC-038", "Delivery", "Shadowfax webhook maps statuses", "POST /webhooks/shadowfax CREATED/COLLECTED/DELIVERED/CANCELLED", "Delivery with order_id or tracking id", "Internal status ASSIGNED/PICKED_UP/DELIVERED/FAILED", "P0", "Webhook", "Not Started", "", ""],
  ["TC-039", "Delivery", "Manual delivery status update", "PATCH /delivery/:id/status", "Active delivery", "Status updates and invalid statuses rejected", "P1", "Positive", "Not Started", "", ""],
  ["TC-040", "Subscriptions", "Admin creates subscription plan", "POST /subscriptions/plans", "Admin token", "201 plan visible to users", "P1", "Positive", "Not Started", "", ""],
  ["TC-041", "Subscriptions", "Chef creates subscription slot", "POST /subscriptions/slots", "Chef token, plan id", "201 slot visible by chef id", "P1", "Positive", "Not Started", "", ""],
  ["TC-042", "Subscriptions", "Upload custom diet plan PDF", "POST /subscriptions/custom/upload", "User token and PDF", "200 Cloudinary URL returned", "P1", "Upload", "Not Started", "", ""],
  ["TC-043", "Fuel", "Admin creates fuel plan", "POST /fuel/plans", "Admin token", "201 plan with delivery slots/menu/nutrition", "P0", "Positive", "Not Started", "", ""],
  ["TC-044", "Fuel", "Chef enables fuel plan", "POST /fuel/chef/slots", "Approved chef token, plan id", "201 chef slot/list updated", "P0", "Positive", "Not Started", "", ""],
  ["TC-045", "Fuel", "User creates fuel subscription", "POST /fuel/subscriptions", "Plan id, assigned chef id, start date, time slot", "201 ACTIVE subscription with end date", "P0", "Positive", "Not Started", "", ""],
  ["TC-046", "Fuel", "Pause fuel subscription", "POST /fuel/subscriptions/:id/pause", "Active subscription", "Subscription/fulfillments paused for date range", "P1", "Positive", "Not Started", "", ""],
  ["TC-047", "Fuel", "Generate and update fulfillments", "POST generate then PATCH status", "Admin/chef token", "Fulfillment status follows valid enum", "P0", "Positive", "Not Started", "", ""],
  ["TC-048", "Fuel", "Chef submits weigh-in proof", "POST /fuel/fulfillments/:id/weigh-in", "Chef fulfillment and proof image", "Proof URL and weight grams stored", "P1", "Upload", "Not Started", "", ""],
  ["TC-049", "Fuel NOW", "Find nearby Fuel NOW chefs", "GET /fuel/now/chefs with lat/lng/time_slot", "Chef slot and user token", "Nearby chefs returned; missing lat/lng gives 400", "P1", "Positive", "Not Started", "", ""],
  ["TC-050", "Fuel NOW", "Dispatch and chef response", "Start dispatch, chef responds accepted/rejected, poll session", "User and chef tokens", "Session state changes and unauthorized responses rejected", "P1", "Integration", "Not Started", "", ""],
  ["TC-051", "Social/Feed", "Follow chef and view feed", "POST follow, GET feed", "Chef with meal/social content", "Feed contains followed chef content and radius rules apply", "P1", "Positive", "Not Started", "", ""],
  ["TC-052", "Social/Feed", "Unfollow chef", "DELETE follow then GET following/feed", "Following record exists", "Chef removed from following/feed", "P1", "Positive", "Not Started", "", ""],
  ["TC-053", "Notifications", "Register device token", "POST device-token", "User token, device token", "201 token stored/updated without duplicates", "P2", "Positive", "Not Started", "", ""],
  ["TC-054", "Admin", "Admin stats and revenue", "GET stats/top-chefs/revenue", "Admin token and seeded data", "Totals match seeded DB/order/payment records", "P1", "Reporting", "Not Started", "", ""],
  ["TC-055", "Admin", "Admin order filters/detail/status", "GET filtered orders, detail, PATCH status", "Admin token, multiple orders", "Filters accurate; detail complete; status override works", "P1", "Positive", "Not Started", "", ""],
  ["TC-056", "Cross-cutting", "Static upload URLs are public absolute URLs", "Create/upload file then inspect API response and open URL", "Any upload flow", "Returned /uploads paths are converted to absolute public URLs where applicable", "P1", "Regression", "Not Started", "", ""],
  ["TC-057", "Cross-cutting", "Error response shape", "Trigger validation, auth, and server-side business errors", "Representative endpoints", "Consistent status/message/errors fields where middleware handles error", "P1", "Regression", "Not Started", "", ""],
  ["TC-058", "Cross-cutting", "Role access matrix", "Call USER/CHEF/ADMIN routes with wrong roles", "Tokens for all roles", "401 for missing token; 403 for wrong role; public routes stay public", "P0", "Security", "Not Started", "", ""],
  ["TC-059", "Timing", "Meal appears for selected service date", "Create meal for tomorrow and list by date", "Chef token, tomorrow date", "Only meals for selected date appear; timezone does not shift date unexpectedly", "P0", "Timing", "Not Started", "", ""],
  ["TC-060", "Timing", "Past meal cannot be ordered if business rule disallows it", "Create/find past-dated meal and attempt order", "Past meal id", "Order rejected or documented behavior confirmed; no slots reduced on rejection", "P0", "Timing", "Not Started", "", ""],
  ["TC-061", "Timing", "Lunch and dinner service windows remain separate", "Create LUNCH and DINNER meals for same chef/date and list/order each", "Two meals same date", "Correct service_window returned and ordered item matches selected window", "P1", "Timing", "Not Started", "", ""],
  ["TC-062", "Timing", "Order status timeline is correct", "Move order PENDING to CONFIRMED to PREPARING to READY_FOR_PICKUP to DELIVERED", "Order id", "updated_at changes on each step and final status visible to user/admin/chef", "P0", "Timing", "Not Started", "", ""],
  ["TC-063", "Timing", "Duplicate rapid order attempts do not oversell slots", "Submit two orders quickly for last available slot", "Meal/social/fuel slot with one remaining", "Only one succeeds or inventory remains correct after both requests", "P0", "Concurrency", "Not Started", "", ""],
  ["TC-064", "Timing", "Payment verification delayed after order creation", "Create order/payment, wait, then verify", "Pending payment", "Payment still verifies correctly before gateway/order expiry rules apply", "P1", "Timing", "Not Started", "", ""],
  ["TC-065", "Timing", "Payment webhook replay after verification", "Verify payment, then send same webhook again", "Completed payment payload", "State remains completed and duplicate webhook does not create duplicate records", "P0", "Webhook", "Not Started", "", ""],
  ["TC-066", "Timing", "Delivery webhook received out of order", "Send DELIVERED before COLLECTED/CREATED for a delivery", "Delivery id/tracking id", "System handles or documents out-of-order behavior without corrupting final state", "P1", "Webhook", "Not Started", "", ""],
  ["TC-067", "Timing", "Delivery webhook replay after final delivery", "Send DELIVERED twice", "Delivered delivery", "Status remains DELIVERED and no duplicate side effects occur", "P0", "Webhook", "Not Started", "", ""],
  ["TC-068", "Timing", "Fuel subscription start and end date calculation", "Create fuel subscription with start_date", "Fuel plan duration_days", "end_date is calculated correctly across month boundary", "P0", "Timing", "Not Started", "", ""],
  ["TC-069", "Timing", "Fuel pause date range boundaries", "Pause subscription from date A to date B", "Active subscription", "Only dates inside pause range are paused; before/after remain active/scheduled", "P0", "Timing", "Not Started", "", ""],
  ["TC-070", "Timing", "Reject invalid fuel pause range", "pause_to before pause_from", "Active subscription", "Validation/business error returned and subscription remains active", "P0", "Negative", "Not Started", "", ""],
  ["TC-071", "Timing", "Fuel fulfillment generation is idempotent", "Run generate twice for same daysAhead", "Admin token", "No duplicate fulfillment rows for same subscription/date", "P0", "Timing", "Not Started", "", ""],
  ["TC-072", "Timing", "Fuel prep reminder window", "Run prep reminders with hoursBefore value", "Scheduled fulfillment", "Reminder sends only for fulfillments inside configured window", "P1", "Timing", "Not Started", "", ""],
  ["TC-073", "Timing", "Fuel NOW dispatch response timeout behavior", "Start dispatch and do not let chef respond", "User token, chef stream optional", "Session reaches documented timeout/no-response state or remains observable without crash", "P1", "Timing", "Not Started", "", ""],
  ["TC-074", "Timing", "Fuel NOW late chef response", "Respond after session already accepted/rejected/expired", "Dispatch session id", "Late response rejected or ignored consistently", "P1", "Timing", "Not Started", "", ""],
  ["TC-075", "Timing", "Social event booking across start/end dates", "Create multi-hour/multi-day event and book", "Social event with end_date", "Booking allowed only for valid upcoming event and date display is correct", "P1", "Timing", "Not Started", "", ""],
  ["TC-076", "Timing", "Admin daily revenue date grouping", "Create paid orders around local day boundary and check daily revenue", "Paid orders with different created_at dates", "Revenue groups by intended business date/timezone", "P1", "Reporting", "Not Started", "", ""],
  ["TC-077", "Timing", "Feed ordering is newest first", "Create meal/social updates at different times for followed chef", "Followed chef with content", "Feed sorts by created_at descending", "P1", "Timing", "Not Started", "", ""],
  ["TC-078", "Timing", "Address/location radius timing after profile update", "Update location then immediately list nearby content/feed", "User token, nearby chef", "Newest location is used immediately; no stale location result", "P1", "Timing", "Not Started", "", ""],
  ["TC-079", "Timing", "Upload URL availability after upload", "Upload image/doc and immediately open returned URL", "Upload sample", "Returned URL is usable immediately or documented delay is acceptable", "P1", "Upload", "Not Started", "", ""],
  ["TC-080", "Timing", "Server restart preserves scheduled/order state", "Create order/fuel subscription, restart backend, re-check state", "Running QA environment", "DB-backed state persists; in-memory Fuel NOW sessions documented as transient if applicable", "P1", "Regression", "Not Started", "", ""],
];
const cases = addSheet("Test Cases", "Detailed Test Cases", "This is the main execution sheet. QA can filter by Module, Priority, Type, or Status.");
writeTable(cases, "A4", ["Case ID", "Module", "Scenario", "Steps", "Test Data", "Expected Result", "Priority", "Type", "Status", "Tester", "Notes"], testCases, "DetailedTestCases", [90, 140, 260, 360, 270, 370, 80, 110, 130, 140, 260]);
addStatusValidation(cases, "I5:I200");

const apiRows = [
  ["Core", "GET", "/api/v1/health", "No", "Public", "Health check", "None", "Expected status ok and timestamp", "TC-057"],
  ["Core", "GET", "/api/v1/docs", "No", "Public", "Swagger documentation", "None", "Docs render and list routes", ""],
  ["Auth", "POST", "/api/v1/auth/register", "No", "Public", "Register user/chef/admin", "name, email, phone, password, optional role/gender", "Duplicate email/phone, invalid email", "TC-001"],
  ["Auth", "POST", "/api/v1/auth/login", "No", "Public", "Email login", "email, password", "Invalid credentials", "TC-003"],
  ["Auth", "GET", "/api/v1/auth/profile", "Yes", "Any role", "Current token profile", "Bearer token", "Missing/expired token", "TC-006"],
  ["Auth", "POST", "/api/v1/auth/send-otp", "No", "Public", "Send phone OTP", "phone", "Invalid/missing phone", "TC-005"],
  ["Auth", "POST", "/api/v1/auth/verify-otp", "No", "Public", "Verify OTP and registration state", "phone, otp", "Expired/wrong OTP", "TC-005"],
  ["Users", "GET", "/api/v1/users/profile", "Yes", "Any role", "Get user profile with chef relation", "Bearer token", "Unauthorized", "TC-006"],
  ["Users", "PATCH", "/api/v1/users/profile", "Yes", "Any role", "Update profile", "name/email/gender", "Invalid email/gender", ""],
  ["Users", "GET", "/api/v1/users/addresses", "Yes", "USER", "List addresses", "Bearer token", "Unauthorized", "TC-007"],
  ["Users", "POST", "/api/v1/users/addresses", "Yes", "USER", "Create address", "label, address_line, city, state, zip_code, lat/lng", "Missing required fields", "TC-007"],
  ["Users", "PATCH", "/api/v1/users/addresses/:id", "Yes", "USER", "Update address", "Address fields", "Cannot update another user's address", ""],
  ["Users", "DELETE", "/api/v1/users/addresses/:id", "Yes", "USER", "Delete address", "Address id", "Cannot delete another user's address", ""],
  ["Users", "PATCH", "/api/v1/users/location", "Yes", "USER", "Update current coordinates", "latitude, longitude", "Missing lat/lng", "TC-009"],
  ["Chefs", "POST", "/api/v1/chefs/register/step-1", "Yes", "Any authenticated applicant", "Chef personal info", "full_name, email, mobile_number, primary_cuisine", "Missing required fields", "TC-010"],
  ["Chefs", "POST", "/api/v1/chefs/register/step-2", "Yes", "Applicant", "Kitchen details", "kitchen_name, address, lat/lng, capacity, appliances", "Step order validation", "TC-012"],
  ["Chefs", "POST", "/api/v1/chefs/register/step-3", "Yes", "Applicant", "Document upload", "government_id, food_safety_cert, kitchen_photo", "Missing/invalid files", "TC-013"],
  ["Chefs", "GET", "/api/v1/chefs/register/status", "Yes", "Applicant/CHEF", "Registration status", "Bearer token", "Unauthorized", "TC-013"],
  ["Chefs", "GET", "/api/v1/chefs/dashboard", "Yes", "CHEF", "Chef dashboard stats", "Bearer token", "Wrong role", ""],
  ["Chefs", "GET", "/api/v1/chefs/profile", "Yes", "CHEF", "Chef profile and bank details", "Bearer token", "Wrong role", ""],
  ["Chefs", "PATCH", "/api/v1/chefs/profile", "Yes", "CHEF", "Update chef profile/bank", "profile fields", "Wrong role/invalid data", ""],
  ["Chefs", "GET", "/api/v1/chefs", "Optional", "Public/user", "Approved chefs list", "optional lat/lng", "Only approved/expected chefs visible", "TC-018"],
  ["Chefs", "GET", "/api/v1/chefs/:id", "No", "Public", "Chef details", "chef id", "404 missing id", ""],
  ["Chefs", "PATCH", "/api/v1/chefs/:id/verify", "Yes", "ADMIN", "Verify chef", "is_verified, trust_tier", "Wrong role", "TC-015"],
  ["Chefs", "PATCH", "/api/v1/chefs/:id/application-status", "Yes", "ADMIN", "Update application status", "status enum", "Invalid status", "TC-015"],
  ["Meals", "POST", "/api/v1/meals", "Yes", "CHEF/ADMIN", "Create meal", "multipart meal fields and optional meal_image", "Wrong role/missing fields", "TC-017"],
  ["Meals", "GET", "/api/v1/meals", "Optional", "Public/user", "List meals", "date, chefId, latitude, longitude", "Filter/radius behavior", "TC-018"],
  ["Meals", "GET", "/api/v1/meals/:id", "No", "Public", "Meal detail", "meal id", "Missing id", ""],
  ["Meals", "PATCH", "/api/v1/meals/:id", "Yes", "CHEF/ADMIN", "Update meal", "meal fields", "Ownership/wrong role", ""],
  ["Meals", "DELETE", "/api/v1/meals/:id", "Yes", "CHEF/ADMIN", "Delete meal", "meal id", "Ownership/wrong role", ""],
  ["Meals", "POST", "/api/v1/meals/:id/proof", "Yes", "CHEF", "Upload batch proof", "batch_proof", "Missing file", "TC-020"],
  ["Pantry", "POST", "/api/v1/pantry", "Yes", "CHEF", "Create pantry item", "name, category, price, inventory, image", "Wrong role/invalid price", "TC-021"],
  ["Pantry", "GET", "/api/v1/pantry", "Optional", "Public/user", "List pantry items", "chefId", "Filter behavior", ""],
  ["Pantry", "GET", "/api/v1/pantry/:id", "No", "Public", "Pantry detail", "item id", "Missing id", ""],
  ["Pantry", "PATCH", "/api/v1/pantry/:id", "Yes", "CHEF", "Update pantry item", "item fields/image", "Ownership/wrong role", ""],
  ["Pantry", "DELETE", "/api/v1/pantry/:id", "Yes", "CHEF", "Delete pantry item", "item id", "Ownership/wrong role", ""],
  ["Social", "POST", "/api/v1/social", "Yes", "CHEF", "Create social event", "title, description, date, end_date, location, price, slots_total, image", "Wrong role/invalid dates", "TC-023"],
  ["Social", "GET", "/api/v1/social/dashboard", "Yes", "CHEF", "Social dashboard", "Bearer token", "Wrong role", ""],
  ["Social", "GET", "/api/v1/social", "Optional", "Public/user", "List social events", "chefId", "Filter behavior", ""],
  ["Social", "GET", "/api/v1/social/:id", "No", "Public", "Social detail", "event id", "Missing id", ""],
  ["Social", "PATCH", "/api/v1/social/:id", "Yes", "CHEF", "Update social event", "event fields/image", "Ownership/wrong role", ""],
  ["Social", "DELETE", "/api/v1/social/:id", "Yes", "CHEF", "Delete social event", "event id", "Ownership/wrong role", ""],
  ["Orders", "POST", "/api/v1/orders/meal", "Yes", "USER", "Create meal order", "mealId, quantity, delivery_address_id", "Invalid meal/quantity", "TC-025"],
  ["Orders", "POST", "/api/v1/orders/pantry", "Yes", "USER", "Create pantry order", "itemId, quantity, deliveryWindow, delivery_address_id", "Inventory/invalid item", "TC-022"],
  ["Orders", "POST", "/api/v1/orders/social", "Yes", "USER", "Book social event", "eventId, quantity, delivery_address_id", "No slots/invalid event", "TC-024"],
  ["Orders", "POST", "/api/v1/orders/checkout", "Yes", "USER", "Mixed cart checkout", "items[], delivery_address_id", "Invalid item type/id", "TC-026"],
  ["Orders", "GET", "/api/v1/orders/user", "Yes", "USER", "User orders", "Bearer token", "Only own orders", "TC-028"],
  ["Orders", "GET", "/api/v1/orders/chef", "Yes", "CHEF", "Chef orders", "statusGroup active/completed", "Wrong role/no chef profile", "TC-029"],
  ["Orders", "PATCH", "/api/v1/orders/:id/status", "Yes", "CHEF/ADMIN", "Update order status", "status enum", "Wrong role/invalid enum", "TC-030"],
  ["Payments", "POST", "/api/v1/payments/create", "Yes", "USER", "Create Razorpay order", "orderId, optional amount", "Amount mismatch/invalid order", "TC-032"],
  ["Payments", "POST", "/api/v1/payments/verify", "No", "Gateway/public callback", "Verify Razorpay payment", "razorpay_order_id, payment_id, signature", "Bad signature", "TC-033"],
  ["Payments", "GET", "/api/v1/payments/orders/:orderId", "Yes", "USER", "Payment status by order", "order id", "Unauthorized/wrong order", "TC-035"],
  ["Payments", "POST", "/api/v1/payments/webhook/razorpay", "No", "Razorpay", "Payment webhook", "raw body + signature", "Missing/bad signature", "TC-034"],
  ["Delivery", "POST", "/api/v1/delivery/process-batch", "Yes", "ADMIN", "Process delivery batches", "None", "Wrong role", ""],
  ["Delivery", "POST", "/api/v1/delivery/auto-dispatch", "Yes", "ADMIN", "Deprecated dispatch alias", "optional order_ids", "Wrong role", ""],
  ["Delivery", "GET", "/api/v1/delivery/active", "Yes", "Any authenticated", "List active deliveries", "Bearer token", "Unauthorized", ""],
  ["Delivery", "PATCH", "/api/v1/delivery/:id/status", "Yes", "Any authenticated", "Manual delivery status", "status enum", "Invalid status", "TC-039"],
  ["Delivery", "POST", "/api/v1/delivery/partners", "Yes", "ADMIN", "Create delivery partner", "name, phone_number, api_key, base_url", "Wrong role", ""],
  ["Delivery", "GET", "/api/v1/delivery/partners", "Yes", "ADMIN", "List delivery partners", "Bearer token", "Wrong role", ""],
  ["Delivery", "PATCH", "/api/v1/delivery/:id/assign", "Yes", "ADMIN", "Assign delivery partner", "delivery id", "Wrong role", ""],
  ["Admin", "GET", "/api/v1/admin/stats", "Yes", "ADMIN", "Platform stats", "Bearer token", "Wrong role", "TC-054"],
  ["Admin", "GET", "/api/v1/admin/top-chefs", "Yes", "ADMIN", "Top chefs", "Bearer token", "Wrong role", "TC-054"],
  ["Admin", "GET", "/api/v1/admin/revenue/daily", "Yes", "ADMIN", "Daily revenue", "Bearer token", "Wrong role", "TC-054"],
  ["Admin", "GET", "/api/v1/admin/orders", "Yes", "ADMIN", "List/filter orders", "status, type, chefId, userId", "Filter accuracy", "TC-055"],
  ["Admin", "GET", "/api/v1/admin/orders/ready", "Yes", "ADMIN", "Ready orders", "None", "Only ready orders", "TC-036"],
  ["Admin", "POST", "/api/v1/admin/deliveries/dispatch-shadowfax", "Yes", "ADMIN", "Dispatch to Shadowfax", "optional order_ids", "Shadowfax errors", "TC-037"],
  ["Admin", "GET", "/api/v1/admin/orders/:id", "Yes", "ADMIN", "Order detail", "order id", "Missing id", "TC-055"],
  ["Admin", "PATCH", "/api/v1/admin/orders/:id/status", "Yes", "ADMIN", "Override order status", "status", "Invalid status", "TC-055"],
  ["Admin", "GET", "/api/v1/admin/chefs", "Yes", "ADMIN", "List/filter chefs", "applicationStatus, isVerified", "Filter accuracy", "TC-015"],
  ["Admin", "GET", "/api/v1/admin/users", "Yes", "ADMIN", "List users", "None", "Wrong role", "TC-054"],
  ["Subscriptions", "POST", "/api/v1/subscriptions/custom/upload", "Yes", "USER", "Upload custom diet plan", "diet_plan file", "Missing file", "TC-042"],
  ["Subscriptions", "POST", "/api/v1/subscriptions/plans", "Yes", "ADMIN", "Create plan", "name, price, deliveriesPerWeek, nutrition", "Wrong role", "TC-040"],
  ["Subscriptions", "GET", "/api/v1/subscriptions/plans", "Optional", "Public/user", "List plans", "latitude, longitude", "Filter behavior", "TC-040"],
  ["Subscriptions", "GET", "/api/v1/subscriptions/plans/:id", "No", "Public", "Plan detail", "plan id", "Missing id", ""],
  ["Subscriptions", "POST", "/api/v1/subscriptions/slots", "Yes", "CHEF", "Create chef slot", "planId, maxSubscribers, deliveryDays", "Wrong role", "TC-041"],
  ["Subscriptions", "GET", "/api/v1/subscriptions/slots/chef/:chefId", "No", "Public", "Slots by chef", "chef id", "Missing id", "TC-041"],
  ["Fuel", "POST", "/api/v1/fuel/plans", "Yes", "ADMIN", "Create fuel plan", "name, goal, description, price, delivery_time_slots, menu_json", "Wrong role/invalid body", "TC-043"],
  ["Fuel", "GET", "/api/v1/fuel/plans", "No", "Public", "List fuel plans", "None", "Empty state", "TC-043"],
  ["Fuel", "GET", "/api/v1/fuel/plans/:id", "No", "Public", "Fuel plan detail", "plan id", "Missing id", ""],
  ["Fuel", "GET", "/api/v1/fuel/plans/:id/chefs", "No", "Public", "Chefs for fuel plan", "delivery_time_slot", "Filter behavior", ""],
  ["Fuel", "GET", "/api/v1/fuel/chef/plans", "Yes", "CHEF", "Chef plan catalog", "Bearer token", "Wrong role", ""],
  ["Fuel", "GET", "/api/v1/fuel/chef/slots", "Yes", "CHEF", "Chef fuel slots", "Bearer token", "Wrong role", "TC-044"],
  ["Fuel", "POST", "/api/v1/fuel/chef/slots", "Yes", "CHEF", "Enable chef plan", "plan_id", "Wrong role/invalid plan", "TC-044"],
  ["Fuel", "POST", "/api/v1/fuel/subscriptions", "Yes", "USER", "Create fuel subscription", "plan_id, assigned_chef_id, start_date, delivery_time_slot", "Invalid chef/slot/date", "TC-045"],
  ["Fuel", "GET", "/api/v1/fuel/subscriptions/me", "Yes", "USER", "List my fuel subscriptions", "Bearer token", "Only own subscriptions", "TC-045"],
  ["Fuel", "POST", "/api/v1/fuel/subscriptions/:id/pause", "Yes", "USER", "Pause subscription", "pause_from, pause_to", "Invalid date range/wrong owner", "TC-046"],
  ["Fuel", "GET", "/api/v1/fuel/chef/subscriptions", "Yes", "CHEF", "Chef fuel subscriptions", "Bearer token", "Wrong role", ""],
  ["Fuel", "GET", "/api/v1/fuel/chef/fulfillments", "Yes", "CHEF", "Chef fulfillments by date", "date", "Wrong role", "TC-047"],
  ["Fuel", "GET", "/api/v1/fuel/now/chef-stream", "Token/header", "CHEF/ADMIN", "Chef SSE stream", "Bearer token or token query", "Wrong role/no chef profile", "TC-050"],
  ["Fuel", "POST", "/api/v1/fuel/now/dispatch", "Yes", "USER", "Start Fuel NOW dispatch", "latitude, longitude, plan_id/item_name/time_slot", "Missing lat/lng", "TC-050"],
  ["Fuel", "GET", "/api/v1/fuel/now/dispatch/:id", "Yes", "USER", "Poll dispatch session", "dispatch id", "404 missing session", "TC-050"],
  ["Fuel", "POST", "/api/v1/fuel/now/dispatch/:id/respond", "Yes", "CHEF", "Chef accept/reject dispatch", "accepted boolean", "Wrong role", "TC-050"],
  ["Fuel", "PATCH", "/api/v1/fuel/fulfillments/:id/status", "Yes", "CHEF/ADMIN", "Fuel fulfillment status", "status enum", "Invalid enum", "TC-047"],
  ["Fuel", "POST", "/api/v1/fuel/fulfillments/:id/weigh-in", "Yes", "CHEF", "Fuel proof and weight", "batch_proof, weight_verification_grams", "Missing file", "TC-048"],
  ["Fuel", "POST", "/api/v1/fuel/fulfillments/generate", "Yes", "ADMIN", "Generate fulfillments", "daysAhead", "Wrong role", "TC-047"],
  ["Fuel", "POST", "/api/v1/fuel/reminders/prep/run", "Yes", "ADMIN", "Run prep reminders", "hoursBefore", "Wrong role", ""],
  ["Fuel", "GET", "/api/v1/fuel/now/chefs", "Yes", "USER", "Nearby Fuel NOW chefs", "latitude, longitude, time_slot", "Missing lat/lng", "TC-049"],
  ["Follows", "POST", "/api/v1/follows/chef/:chefId", "Yes", "USER", "Follow chef", "chef id", "Duplicate follow", "TC-051"],
  ["Follows", "DELETE", "/api/v1/follows/chef/:chefId", "Yes", "USER", "Unfollow chef", "chef id", "No existing follow", "TC-052"],
  ["Follows", "GET", "/api/v1/follows/following", "Yes", "USER", "List following", "Bearer token", "Unauthorized", "TC-051"],
  ["Feed", "GET", "/api/v1/feed", "Yes", "USER", "Followed chef feed", "latitude, longitude", "No follows empty list", "TC-051"],
  ["Notifications", "POST", "/api/v1/notifications/device-token", "Yes", "USER", "Register push token", "token, platform", "Duplicate token", "TC-053"],
  ["Webhooks", "POST", "/api/v1/webhooks/shadowfax", "No", "Shadowfax", "Delivery webhook", "coid, status", "Missing coid/status", "TC-038"],
  ["Webhooks", "POST", "/api/v1/webhooks/borzo", "No", "Borzo", "Legacy delivery webhook", "order object + optional signature", "Missing/invalid signature", "TC-038"],
];
const api = addSheet("API Coverage", "API Coverage Matrix", "Route-level checklist for backend/API testing. Use linked cases where available.");
writeTable(api, "A4", ["Module", "Method", "Endpoint", "Auth", "Role", "Purpose", "Required Payload or Query", "Negative Checks", "Linked Case"], apiRows, "ApiCoverage", [130, 70, 300, 90, 130, 250, 330, 260, 100]);

const webhookRows = [
  ["Razorpay", "/api/v1/payments/webhook/razorpay", "x-razorpay-signature", "raw request body required", "Payment events from Razorpay", "Payment/order should update only when signature is valid", "Use Razorpay test dashboard/webhook replay where possible"],
  ["Shadowfax", "/api/v1/webhooks/shadowfax", "None in router", "coid, status", "CREATED/ALLOTTED/ACCEPTED/ARRIVED", "ASSIGNED", "coid may match order_id or external_tracking_id"],
  ["Shadowfax", "/api/v1/webhooks/shadowfax", "None in router", "coid, status", "COLLECTED/CUSTOMER_DOOR_STEP", "PICKED_UP", "Verify order delivery status updates once only"],
  ["Shadowfax", "/api/v1/webhooks/shadowfax", "None in router", "coid, status", "DELIVERED", "DELIVERED", "Confirm delivered_time/order visibility if service updates it"],
  ["Shadowfax", "/api/v1/webhooks/shadowfax", "None in router", "coid, status", "CANCELLED/RTS_INITIATED/RTS_COMPLETED", "FAILED", "Confirm failure reflected to admin/user"],
  ["Borzo Legacy", "/api/v1/webhooks/borzo", "x-dv-signature if BORZO_WEBHOOK_SECRET is configured", "order.order_id, order.status", "available", "ASSIGNED", "Legacy regression only if Borzo remains supported"],
  ["Borzo Legacy", "/api/v1/webhooks/borzo", "x-dv-signature if configured", "order.order_id, order.status", "active", "PICKED_UP", "Verify signature with raw body"],
  ["Borzo Legacy", "/api/v1/webhooks/borzo", "x-dv-signature if configured", "order.order_id, order.status", "completed", "DELIVERED", ""],
  ["Borzo Legacy", "/api/v1/webhooks/borzo", "x-dv-signature if configured", "order.order_id, order.status", "canceled/failed", "FAILED", ""],
];
const webhooks = addSheet("Webhooks", "Payment and Delivery Webhook Matrix", "Use this tab for external callback tests and status mapping.");
writeTable(webhooks, "A4", ["Provider", "Endpoint", "Signature Header", "Payload Requirement", "External Status/Event", "Expected Internal Result", "QA Notes"], webhookRows, "WebhookMatrix", [140, 310, 230, 260, 250, 230, 340]);

const riskRows = [
  ["Security", "Missing token returns 401 on protected routes", "All protected modules", "P0", "Not Started", "", ""],
  ["Security", "Wrong role returns 403 on chef/admin routes", "Chef/Admin/Fuel/Delivery", "P0", "Not Started", "", ""],
  ["Security", "Users cannot see or mutate other users' orders/addresses/subscriptions", "Users/Orders/Fuel", "P0", "Not Started", "", ""],
  ["Data Integrity", "Slots and inventory reduce once per successful order only", "Meals/Pantry/Social/Fuel", "P0", "Not Started", "", ""],
  ["Data Integrity", "Failed payments do not mark orders paid/completed", "Payments/Orders", "P0", "Not Started", "", ""],
  ["Data Integrity", "Webhook replay is idempotent or at least non-destructive", "Payments/Delivery", "P0", "Not Started", "", ""],
  ["Uploads", "All upload endpoints reject missing files and return usable URLs for valid files", "Chef/Meals/Pantry/Social/Fuel", "P1", "Not Started", "", ""],
  ["Validation", "Invalid enums are rejected", "Orders/Fuel/Delivery/Chef status", "P0", "Not Started", "", ""],
  ["Validation", "Invalid lat/lng and missing coordinates are rejected where required", "Users/Fuel NOW/Feed", "P1", "Not Started", "", ""],
  ["Reliability", "External provider failure returns readable error and no broken local state", "Razorpay/Shadowfax/Cloudinary/Twilio", "P1", "Not Started", "", ""],
  ["Reporting", "Admin totals reconcile with DB seed/order/payment records", "Admin", "P1", "Not Started", "", ""],
  ["Compatibility", "Swagger docs remain reachable and reflect active API prefix", "Docs", "P2", "Not Started", "", ""],
];
const risks = addSheet("Risk Checklist", "Cross-Flow Risk Checklist", "These are high-value checks that often catch issues missed by happy-path API testing.");
writeTable(risks, "A4", ["Category", "Check", "Area", "Priority", "Status", "Evidence Link", "Notes"], riskRows, "RiskChecklist", [140, 420, 180, 80, 130, 220, 320]);
addStatusValidation(risks, "E5:E100");

const timingRows = [
  ["Meals", "Meal date filter", "Create meals for yesterday/today/tomorrow and query each date", "Correct date bucket only; no timezone date shift", "P0", "Not Started", "TC-059"],
  ["Meals", "Past ordering", "Attempt order for past-dated meal", "Rejected or explicitly accepted per product rule; inventory remains correct", "P0", "Not Started", "TC-060"],
  ["Meals", "Service window", "Use LUNCH and DINNER on same day", "Windows stay separate in browse, detail, and order", "P1", "Not Started", "TC-061"],
  ["Orders", "Status sequence timing", "Move status through full chef/admin lifecycle", "updated_at changes; dashboards reflect latest status", "P0", "Not Started", "TC-062"],
  ["Orders", "Rapid last-slot ordering", "Submit two simultaneous orders for one remaining slot", "No oversell or duplicate successful allocation", "P0", "Not Started", "TC-063"],
  ["Payments", "Delayed verification", "Verify payment after a delay", "Payment can still complete within gateway rules", "P1", "Not Started", "TC-064"],
  ["Payments", "Webhook replay", "Send same successful webhook more than once", "No duplicate payment/order side effects", "P0", "Not Started", "TC-065"],
  ["Delivery", "Out-of-order callback", "Send terminal delivery callback before earlier callback", "Final state remains sensible and auditable", "P1", "Not Started", "TC-066"],
  ["Delivery", "Final callback replay", "Replay DELIVERED callback", "Status remains delivered; no duplicate effects", "P0", "Not Started", "TC-067"],
  ["Fuel", "Start/end date", "Create subscription near month boundary", "end_date uses duration_days correctly", "P0", "Not Started", "TC-068"],
  ["Fuel", "Pause boundaries", "Pause from date A to B", "Only included dates paused", "P0", "Not Started", "TC-069"],
  ["Fuel", "Invalid pause range", "pause_to earlier than pause_from", "Rejected with no state change", "P0", "Not Started", "TC-070"],
  ["Fuel", "Fulfillment idempotency", "Run fulfillment generation twice", "No duplicate fulfillment for same subscription/date", "P0", "Not Started", "TC-071"],
  ["Fuel", "Reminder window", "Run prep reminders with custom hoursBefore", "Only target-window fulfillments reminded", "P1", "Not Started", "TC-072"],
  ["Fuel NOW", "No response timeout", "Start session and leave chef unanswered", "Timeout/no-response behavior documented and stable", "P1", "Not Started", "TC-073"],
  ["Fuel NOW", "Late response", "Chef responds after session final state", "Late response ignored or rejected", "P1", "Not Started", "TC-074"],
  ["Social", "Event date range", "Book event with start/end date", "Date range and availability behavior correct", "P1", "Not Started", "TC-075"],
  ["Admin", "Daily revenue boundary", "Paid orders around local midnight", "Revenue grouped by intended business date/timezone", "P1", "Not Started", "TC-076"],
  ["Feed", "Chronological sort", "Create content at different times", "Newest content appears first", "P1", "Not Started", "TC-077"],
  ["Location", "Immediate location update", "Update coordinates then browse/feed", "Latest location used immediately", "P1", "Not Started", "TC-078"],
  ["Uploads", "Post-upload availability", "Open returned URL immediately after upload", "URL is available or expected propagation delay documented", "P1", "Not Started", "TC-079"],
  ["Reliability", "Restart persistence", "Restart backend after creating DB-backed records", "DB-backed state remains; transient in-memory sessions documented", "P1", "Not Started", "TC-080"],
];
const timing = addSheet("Timing Scenarios", "Timing and Boundary Scenarios", "Dedicated timing checks for dates, slots, callbacks, scheduling, retries, and concurrency.");
writeTable(timing, "A4", ["Area", "Scenario", "Steps", "Expected Result", "Priority", "Status", "Linked Case"], timingRows, "TimingScenarios", [130, 240, 390, 390, 80, 130, 100]);
addStatusValidation(timing, "F5:F100");

const signRows = [
  ["P0 smoke cycle", "QA Lead", "", "", "Not Started", "Health, auth, chef approval, meal order, payment, delivery dispatch"],
  ["Regression cycle", "QA Lead", "", "", "Not Started", "All P0/P1 cases executed or explicitly marked N/A"],
  ["Payment sign-off", "Product/Finance", "", "", "Not Started", "Razorpay amount, signature, status, webhook behavior verified"],
  ["Delivery sign-off", "Ops", "", "", "Not Started", "Shadowfax testing dispatch and webhook mapping verified"],
  ["Fuel sign-off", "Product/Ops", "", "", "Not Started", "Fuel plan/subscription/fulfillment/Fuel NOW verified"],
  ["Release recommendation", "QA Lead + Engineering", "", "", "Not Started", "Open blockers reviewed and accepted/resolved"],
];
const sign = addSheet("Sign Off", "QA Sign-Off", "Capture ownership and final approval for release readiness.");
writeTable(sign, "A4", ["Milestone", "Owner", "Date", "Signature/Name", "Status", "Notes"], signRows, "SignOff", [210, 190, 130, 190, 130, 480]);
addStatusValidation(sign, "E5:E50");

// Light formatting pass for all sheets.
for (const sheetName of ["Environment", "Test Data", "E2E Flows", "Test Cases", "API Coverage", "Webhooks", "Risk Checklist", "Timing Scenarios", "Sign Off"]) {
  const sheet = workbook.worksheets.getItem(sheetName);
  const used = sheet.getUsedRange();
  used.format.font = { name: "Aptos", size: 10 };
}

// Re-apply title font after global font pass.
for (const sheetName of ["Start Here", "Environment", "Test Data", "E2E Flows", "Test Cases", "API Coverage", "Webhooks", "Risk Checklist", "Timing Scenarios", "Sign Off"]) {
  const sheet = workbook.worksheets.getItem(sheetName);
  sheet.getRange("A1").format = {
    fill: theme.navy,
    font: { name: "Aptos Display", bold: true, color: theme.headerText, size: 16 },
  };
}

await fs.mkdir(outputDir, { recursive: true });

for (const sheetName of ["Start Here", "Environment", "Test Data", "E2E Flows", "Test Cases", "API Coverage", "Webhooks", "Risk Checklist", "Timing Scenarios", "Sign Off"]) {
  const preview = await workbook.render({ sheetName, autoCrop: "all", scale: 1, format: "png" });
  await fs.writeFile(`${outputDir}/preview_${sheetName.replace(/[^A-Za-z0-9]/g, "_")}.png`, new Uint8Array(await preview.arrayBuffer()));
}

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(errors.ndjson);

const summary = await workbook.inspect({
  kind: "table",
  range: "Start Here!A16:H17",
  include: "values,formulas",
  tableMaxRows: 5,
  tableMaxCols: 8,
});
console.log(summary.ndjson);

const xlsx = await SpreadsheetFile.exportXlsx(workbook);
await xlsx.save(outputPath);
console.log(outputPath);

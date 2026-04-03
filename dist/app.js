"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importStar(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
require("reflect-metadata");
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./config/swagger");
const auth_middleware_1 = require("./common/middleware/auth.middleware");
const auth_router_1 = __importDefault(require("./auth/auth.router"));
const users_router_1 = __importDefault(require("./users/users.router"));
const chefs_router_1 = __importDefault(require("./chefs/chefs.router"));
const meals_router_1 = __importDefault(require("./meals/meals.router"));
const orders_router_1 = __importDefault(require("./orders/orders.router"));
const pantry_router_1 = __importDefault(require("./pantry/pantry.router"));
const payments_router_1 = __importDefault(require("./payments/payments.router"));
const subscriptions_router_1 = __importDefault(require("./subscriptions/subscriptions.router"));
const delivery_router_1 = __importDefault(require("./delivery/delivery.router"));
const admin_router_1 = __importDefault(require("./admin/admin.router"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use((0, cors_1.default)({
    origin: '*',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
}));
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, auth_middleware_1.initializePassport)());
app.get('/', (req, res) => {
    res.send('Hello World!');
});
const apiV1Router = (0, express_1.Router)();
app.use('/api/v1', apiV1Router);
apiV1Router.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
apiV1Router.use('/auth', auth_router_1.default);
apiV1Router.use('/users', users_router_1.default);
apiV1Router.use('/chefs', chefs_router_1.default);
apiV1Router.use('/meals', meals_router_1.default);
apiV1Router.use('/orders', orders_router_1.default);
apiV1Router.use('/pantry', pantry_router_1.default);
apiV1Router.use('/payments', payments_router_1.default);
apiV1Router.use('/subscriptions', subscriptions_router_1.default);
apiV1Router.use('/delivery', delivery_router_1.default);
apiV1Router.use('/admin', admin_router_1.default);
apiV1Router.use('/docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(swagger_1.swaggerSpec));
app.use((err, req, res, next) => {
    console.error(err.stack);
    const status = err.status || 500;
    res.status(status).json({
        status: 'error',
        message: err.message || 'Internal Server Error',
        errors: err.errors || undefined,
    });
});
exports.default = app;
//# sourceMappingURL=app.js.map
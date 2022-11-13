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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingService = void 0;
const JSONv2 = __importStar(require("../../utils/json.js"));
const BaseService_js_1 = require("../BaseService.js");
class MessagingService extends BaseService_js_1.BaseService {
    async publishTopicMessage(universeId, topicName, data) {
        return (await this.rest.httpRequest({
            method: "POST",
            url: MessagingService.urls.publishTopicMessage(universeId, topicName),
            body: {
                type: "json",
                value: {
                    message: typeof data === "string"
                        ? data
                        : JSONv2.serialize(data),
                },
            },
            expect: "none",
            errorHandling: "BEDEV2",
            includeCredentials: true,
        })).body;
    }
}
exports.MessagingService = MessagingService;
Object.defineProperty(MessagingService, "urls", {
    enumerable: true,
    configurable: true,
    writable: true,
    value: {
        publishTopicMessage: (universeId, topicName) => `{BEDEV2Url:messaging-service}/v1/universes/${universeId}/topics/${topicName}`,
    }
});

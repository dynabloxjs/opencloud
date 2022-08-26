import { OpenCloudClientError } from "../../../clients/OpenCloudClient.js";
import { BaseUniverse } from "./BaseUniverse.js";
/**
 * Base Place class for Open Cloud.
 */
export class BasePlace {
    /**
     * Construct a new Base Place with its place ID and parent universe ID.
     * @param client - The base client to use services from.
     * @param id - The place ID.
     * @param parentUniverseId - The parent universe id.
     */
    constructor(client, id, parentUniverseId) {
        /**
         * The ID of the place.
         */
        Object.defineProperty(this, "id", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * The parent universe ID of the place.
         */
        Object.defineProperty(this, "parentUniverseId", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /**
         * The client to use services from.
         */
        Object.defineProperty(this, "_client", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this._client = client;
        this.id = id;
        this.parentUniverseId = parentUniverseId;
    }
    /**
     * Update the contents for a place. This will create a new Place version, and the version will be `Published` if `placeVersionType` is `Published`.
     * @param data
     * @param placeVersionType
     */
    async updateContents(data, placeVersionType = "Saved") {
        if (!this.parentUniverseId) {
            throw new OpenCloudClientError("Can not use `updatePlaceData` on a place with no parentUniverseId.");
        }
        this._client.canAccessResource("universe-places", [this.parentUniverseId.toString()], "write", [false]);
        if (data.length > 100000000) {
            throw new OpenCloudClientError(`data execeeds the maximum allowed 100MB (${data.length.toLocaleString()}).`);
        }
        return (await this._client.services.opencloud.PlaceManagementService
            .updatePlaceData(this.parentUniverseId, this.id, data, placeVersionType)).versionNumber;
    }
    /**
     * Gets the parent universe of the Place.
     *
     * This will also update the place's `parentUniverseId` field.
     */
    async getParentUniverse() {
        const { universeId } = await this._client.services.opencloud
            .PlaceManagementService.getPlaceUniverseId(this.id);
        if (!universeId) {
            throw new OpenCloudClientError(`Place ID ${this.id} does not have a parent Universe.`);
        }
        this.parentUniverseId = universeId;
        return new BaseUniverse(this._client, universeId);
    }
}

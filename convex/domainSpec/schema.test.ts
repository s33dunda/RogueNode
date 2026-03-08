import { describe, expect, it } from "vitest";
import { domainBundleSchema, missionSchema, roomSchema } from "./schema";

describe("domainSpec schema", () => {
	it("accepts a valid room definition", () => {
		expect(
			roomSchema.parse({
				id: "server-room",
				name: "Server Room",
				description: "Ops closet",
				exits: {
					north: null,
					south: null,
					east: null,
					west: null,
				},
			}),
		).toMatchObject({ id: "server-room" });
	});

	it("applies mission defaults through the bundle schema", () => {
		const parsed = domainBundleSchema.parse({
			rooms: [
				{
					id: "server-room",
					name: "Server Room",
					description: "Ops closet",
					exits: {
						north: null,
						south: null,
						east: null,
						west: null,
					},
				},
			],
		});

		expect(parsed.enemies).toEqual([]);
		expect(parsed.missions).toEqual([]);
	});

	it("requires a mission title", () => {
		expect(() =>
			missionSchema.parse({
				id: "ping-tutorial",
				synopsis: "Bring the server online",
				entryRoomId: "server-room",
				successCondition: "Reachable",
			}),
		).toThrow();
	});
});

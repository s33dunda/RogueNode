// Import shared types from Convex for single source of truth
import type {
	CommandLineTool,
	CommandResult,
	GameState,
	Room,
	RoomsRecord,
} from "../convex/types";

// Command action types for dependency injection
export interface CommandArgs {
	target: string;
	gameState: GameState;
	threadId?: string;
}

export interface GameActions {
	executePingCommand?: (args: CommandArgs) => Promise<CommandResult>;
	// Future actions for other command-line tools
	// executeSSHCommand?: (args: SSHCommandArgs) => Promise<SSHCommandResult>;
	// executeDockerCommand?: (args: DockerCommandArgs) => Promise<DockerCommandResult>;
}

// Map of the dungeon
export const gameMap = {
	width: 5,
	height: 5,
};

// Rooms in the dungeon
export const rooms: RoomsRecord = {
	"server-room": {
		id: "server-room",
		name: "Server Room",
		description:
			"A chilly room filled with racks of humming servers. Blinking lights cast an eerie glow on the walls. The main terminal shows critical errors.",
		exits: {
			north: null,
			south: "corridor-1",
			east: null,
			west: null,
		},
	},
	"corridor-1": {
		id: "corridor-1",
		name: "Main Corridor",
		description:
			"A long corridor with exposed cables running along the ceiling. Emergency lights flash intermittently, bathing the area in red.",
		exits: {
			north: "server-room",
			south: "network-hub",
			east: "storage-room",
			west: "monitoring-station",
		},
	},
	"network-hub": {
		id: "network-hub",
		name: "Network Hub",
		description:
			"The central networking hub with dozens of interconnected switches and routers. Many of the connection lights are dark or flashing in error patterns.",
		exits: {
			north: "corridor-1",
			south: "datacenter-core",
			east: null,
			west: null,
		},
	},
	"storage-room": {
		id: "storage-room",
		name: "Storage Room",
		description:
			"A cluttered storage area filled with old equipment, spare parts, and maintenance tools. Dust covers most surfaces, suggesting infrequent visits.",
		exits: {
			north: null,
			south: null,
			east: null,
			west: "corridor-1",
		},
	},
	"monitoring-station": {
		id: "monitoring-station",
		name: "Monitoring Station",
		description:
			"A small room with multiple monitors showing system statistics. Most displays are showing critical alerts and error messages.",
		exits: {
			north: null,
			south: null,
			east: "corridor-1",
			west: null,
		},
	},
	"datacenter-core": {
		id: "datacenter-core",
		name: "Datacenter Core",
		description:
			"The heart of the datacenter. Massive cooling systems struggle to maintain temperature. The central mainframe appears to be in lockdown mode.",
		exits: {
			north: "network-hub",
			south: "backup-facility",
			east: "security-office",
			west: null,
		},
	},
	"security-office": {
		id: "security-office",
		name: "Security Office",
		description:
			"The datacenter security room. Monitors show camera feeds from throughout the facility. The intrusion detection system is flashing warnings.",
		exits: {
			north: null,
			south: null,
			east: null,
			west: "datacenter-core",
		},
	},
	"backup-facility": {
		id: "backup-facility",
		name: "Backup Facility",
		description:
			"A separate room housing backup systems and tape drives. The automated backup process appears to have failed mid-cycle.",
		exits: {
			north: "datacenter-core",
			south: null,
			east: null,
			west: null,
		},
	},
};

// Items that can be found
export const items = [
	{
		id: "debug-tool",
		name: "Debug Tool",
		description: "A specialized diagnostic tool for identifying network issues",
		location: "storage-room",
		taken: false,
		aliases: ["tool", "debugger", "diagnostic"],
		examineText:
			"A professional-grade network diagnostic tool. The display shows it's charged and ready to use.",
		onTake:
			"The tool lights up as you pick it up, ready to diagnose network problems.",
		use: (_gameState: GameState) => ({
			message: [
				"You run a network diagnostic scan. The tool identifies several vulnerabilities.",
			],
			updateState: {},
		}),
	},
	{
		id: "admin-keycard",
		name: "Admin Keycard",
		description: "A high-level access card for secured systems",
		location: "monitoring-station",
		taken: false,
		aliases: ["card", "keycard", "access card"],
		examineText:
			"The keycard belongs to the lead system administrator. It has access to all secure areas.",
		use: (_gameState: GameState) => ({
			message: [
				"You swipe the admin keycard. Access granted to secure systems.",
			],
			updateState: {},
		}),
	},
	{
		id: "backup-drive",
		name: "Backup Drive",
		description: "An external drive containing clean system backups",
		location: "backup-facility",
		taken: false,
		aliases: ["drive", "backup", "external drive"],
		examineText:
			"A high-capacity drive containing verified clean backups of critical systems.",
		use: (_gameState: GameState) => ({
			message: [
				"You connect the backup drive. Clean system images are ready for restoration.",
			],
			updateState: {},
		}),
	},
	{
		id: "security-patch",
		name: "Security Patch",
		description: "A USB drive containing the latest security patches",
		location: "security-office",
		taken: false,
		aliases: ["patch", "usb", "drive"],
		examineText:
			"The USB contains critical security patches that haven't been applied yet.",
		use: (_gameState: GameState) => ({
			message: [
				"You deploy the security patches. Systems are being updated with the latest protections.",
			],
			updateState: {},
		}),
	},
];

// Enemies (system problems to fix)
export const enemies = [
	{
		id: "malware-infection",
		name: "Malware Infection",
		description: "A critical system infected with ransomware",
		location: "server-room",
		defeated: false,
		requiredItemId: "security-patch",
		aliases: ["malware", "virus", "infection", "ransomware"],
		examineText:
			"The system is locked by ransomware. You'll need security patches to clean this infection.",
		failMessage:
			"Your attempt to manually remove the malware fails. You need proper security patches.",
		defeatMessage:
			"You successfully deploy the security patch, neutralizing the ransomware and restoring system access.",
	},
	{
		id: "network-breach",
		name: "Network Breach",
		description: "An ongoing network intrusion from an unknown source",
		location: "network-hub",
		defeated: false,
		requiredItemId: "debug-tool",
		aliases: ["breach", "intrusion", "network"],
		examineText:
			"Active network intrusion in progress. The attack is coming from multiple vectors.",
		failMessage:
			"Without proper diagnostics, you can't identify all intrusion points.",
		defeatMessage:
			"Using the debug tool, you identify and block all intrusion points, securing the network.",
	},
	{
		id: "corrupted-database",
		name: "Corrupted Database",
		description: "The main database cluster has become corrupted",
		location: "datacenter-core",
		defeated: false,
		requiredItemId: "backup-drive",
		aliases: ["database", "db", "corruption", "corrupted"],
		examineText:
			"The database shows significant corruption. Records are being lost by the minute.",
		failMessage: "Manual database repair attempts only worsen the corruption.",
		defeatMessage:
			"You restore the database from the clean backup, bringing the system back online.",
	},
	{
		id: "locked-mainframe",
		name: "Locked Mainframe",
		description: "The central mainframe is in security lockdown",
		location: "datacenter-core",
		defeated: false,
		requiredItemId: "admin-keycard",
		aliases: ["mainframe", "lockdown", "locked"],
		examineText:
			"The mainframe entered emergency lockdown. Only admin access can override this.",
		failMessage: "Security protocols prevent unauthorized access attempts.",
		defeatMessage:
			"You use the admin keycard to authenticate and successfully override the lockdown.",
	},
];

// DevOps/SRE tools available in the game
export const commandLineTools: CommandLineTool[] = [
	{
		name: "ping",
		syntax: "ping [system]",
		description: "Checks connectivity to a specified system or service",
		example: "ping auth-service",
		explanation:
			"Sends ICMP echo requests to verify if a system is reachable on the network.",
	},
	{
		name: "ssh",
		syntax: "ssh [system]",
		description: "Securely connects to a remote system for administration",
		example: "ssh database-01",
		explanation:
			"Establishes an encrypted shell connection to access and control remote systems.",
	},
	{
		name: "tail",
		syntax: "tail -f [logfile]",
		description: "Displays the end of a log file in real-time",
		example: "tail -f system.log",
		explanation:
			"Continuously monitors log files for new entries, essential for real-time troubleshooting.",
	},
	{
		name: "grep",
		syntax: "grep [pattern] [file]",
		description: "Searches for specific patterns in files",
		example: "grep ERROR system.log",
		explanation:
			"Filters text to find specific error messages or patterns in log files and outputs.",
	},
	{
		name: "netstat",
		syntax: "netstat -tuln",
		description: "Displays network connections and listening ports",
		example: "netstat -tuln",
		explanation:
			"Shows active connections and open ports, helping identify unexpected network activity.",
	},
	{
		name: "docker",
		syntax: "docker [command]",
		description: "Manages containerized applications",
		example: "docker ps",
		explanation:
			"Controls container lifecycle, allowing deployment and management of isolated services.",
	},
	{
		name: "kubectl",
		syntax: "kubectl [command]",
		description: "Controls Kubernetes clusters",
		example: "kubectl get pods",
		explanation:
			"Orchestrates containerized applications across multiple hosts in a cluster environment.",
	},
	{
		name: "top",
		syntax: "top",
		description: "Monitors system resource usage in real-time",
		example: "top",
		explanation:
			"Displays CPU, memory, and process information to identify performance bottlenecks.",
	},
];

// Starting room
export const initialRoom: Room = rooms["server-room"];

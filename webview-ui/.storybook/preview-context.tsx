import { ExtensionStateContextType, ExtensionStateContext } from "../src/context/ExtensionStateContext"
import { defaultExtensionState } from "../../src/shared/ExtensionMessage"
import { McpServer } from "../../src/shared/mcp"
import { ApiConfiguration, ModelInfo } from "../../src/shared/api"
import { HistoryItem } from "../../src/shared/HistoryItem" // Import HistoryItem
import { useContext } from "react"

// Mock ModelInfo
const mockModelInfo: ModelInfo = {
	contextWindow: 2048,
	supportsImages: true,
	supportsPromptCache: true,
	reasoningEffort: "low",
}

// Mock API configuration
const mockApiConfig: ApiConfiguration = {
	apiModelId: "mock-model",
	glamaModelInfo: mockModelInfo,
}

// Mock MCP server
const mockMcpServer: McpServer = {
	name: "mock-server",
	tools: [],
	resources: [],
	resourceTemplates: [],
	disabled: false,
	config: "?",
	status: "disconnected",
}

// Mock task history item (Corrected to match HistoryItem type)
const mockTaskHistoryItem: HistoryItem = {
	id: "mock-task-id",
	ts: Date.now(),
	task: "Sample task",
	tokensIn: 100,
	tokensOut: 200,
	totalCost: 0.5,
}

// Mock file paths and opened tabs (more realistic mock data)
const mockFilePaths: string[] = [
	"/Roo-Code/src/components/chat/ChatTextArea.tsx",
	"/Roo-Code/src/components/common/CodeBlock.tsx",
	"/Roo-Code/webview-ui/.storybook/preview-context.tsx",
]
const mockOpenedTabs: Array<{ label: string; isActive: boolean; path?: string }> = [
	{ label: "ChatTextArea.tsx", isActive: true, path: "/Roo-Code/src/components/chat/ChatTextArea.tsx" },
	{ label: "CodeBlock.tsx", isActive: false, path: "/Roo-Code/src/components/common/CodeBlock.tsx" },
]

const defaultContext: ExtensionStateContextType = {
	...defaultExtensionState,
	// Override specific properties for testing
	theme: {},
	didHydrateState: true,
	showWelcome: false,
	apiConfiguration: mockApiConfig,
	mcpServers: [mockMcpServer],
	taskHistory: [mockTaskHistoryItem],
	filePaths: mockFilePaths,
	openedTabs: mockOpenedTabs,
	// Add setter functions
	setApiConfiguration: () => {},
	setCustomInstructions: () => {},
	setAlwaysAllowReadOnly: () => {},
	setAlwaysAllowWrite: () => {},
	setAlwaysAllowExecute: () => {},
	setAlwaysAllowBrowser: () => {},
	setAlwaysAllowMcp: () => {},
	setAlwaysAllowModeSwitch: () => {},
	setShowAnnouncement: () => {},
	setAllowedCommands: () => {},
	setSoundEnabled: () => {},
	setSoundVolume: () => {},
	setDiffEnabled: () => {},
	setCheckpointsEnabled: () => {},
	setBrowserViewportSize: () => {},
	setFuzzyMatchThreshold: () => {},
	setPreferredLanguage: () => {},
	setWriteDelayMs: () => {},
	setScreenshotQuality: () => {},
	setTerminalOutputLineLimit: () => {},
	setMcpEnabled: () => {},
	setEnableMcpServerCreation: () => {},
	setAlwaysApproveResubmit: () => {},
	setRequestDelaySeconds: () => {},
	setRateLimitSeconds: () => {},
	setCurrentApiConfigName: () => {},
	setListApiConfigMeta: () => {},
	setMode: () => {},
	setCustomModePrompts: () => {},
	setCustomSupportPrompts: () => {},
	setEnhancementApiConfigId: () => {},
	setExperimentEnabled: () => {},
	setAutoApprovalEnabled: () => {},
	setCustomModes: () => {},
	setMaxOpenTabsContext: () => {},
}

export const PreviewExtensionStateContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
	console.log("PreviewExtensionStateContextProvider is rendering!") // Re-add console log
	console.log("Context Value:", defaultContext) // Log context value
	return <ExtensionStateContext.Provider value={defaultContext}>{children}</ExtensionStateContext.Provider>
}

export const usePreviewExtensionState = () => {
	const context = useContext(ExtensionStateContext)
	console.log("useExtensionState Hook Context:", context) // Log context in hook
	return context
}

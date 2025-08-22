import * as vscode from "vscode"
import delay from "delay"

import type { CommandId } from "@roo-code/types"
import { TelemetryService } from "@roo-code/telemetry"

import { Package } from "../shared/package"
import { getCommand } from "../utils/commands"
import { ClineProvider } from "../core/webview/ClineProvider"
import { ContextProxy } from "../core/config/ContextProxy"
import { focusPanel } from "../utils/focusPanel"
import { AnimationConfig } from "../integrations/editor/components/AnimationConfig"

import { registerHumanRelayCallback, unregisterHumanRelayCallback, handleHumanRelayResponse } from "./humanRelay"
import { handleNewTask } from "./handleTask"
import { CodeIndexManager } from "../services/code-index/manager"
import { importSettingsWithFeedback } from "../core/config/importExport"
import { MdmService } from "../services/mdm/MdmService"
import { t } from "../i18n"

/**
 * Helper to get the visible ClineProvider instance or log if not found.
 */
export function getVisibleProviderOrLog(outputChannel: vscode.OutputChannel): ClineProvider | undefined {
	const visibleProvider = ClineProvider.getVisibleInstance()
	if (!visibleProvider) {
		outputChannel.appendLine("Cannot find any visible Roo Code instances.")
		return undefined
	}
	return visibleProvider
}

// Store panel references in both modes
let sidebarPanel: vscode.WebviewView | undefined = undefined
let tabPanel: vscode.WebviewPanel | undefined = undefined

/**
 * Get the currently active panel
 * @returns WebviewPanel或WebviewView
 */
export function getPanel(): vscode.WebviewPanel | vscode.WebviewView | undefined {
	return tabPanel || sidebarPanel
}

/**
 * Set panel references
 */
export function setPanel(
	newPanel: vscode.WebviewPanel | vscode.WebviewView | undefined,
	type: "sidebar" | "tab",
): void {
	if (type === "sidebar") {
		sidebarPanel = newPanel as vscode.WebviewView
		tabPanel = undefined
	} else {
		tabPanel = newPanel as vscode.WebviewPanel
		sidebarPanel = undefined
	}
}

export type RegisterCommandOptions = {
	context: vscode.ExtensionContext
	outputChannel: vscode.OutputChannel
	provider: ClineProvider
}

export const registerCommands = (options: RegisterCommandOptions) => {
	const { context } = options

	for (const [id, callback] of Object.entries(getCommandsMap(options))) {
		const command = getCommand(id as CommandId)
		context.subscriptions.push(vscode.commands.registerCommand(command, callback))
	}
}

const getCommandsMap = ({ context, outputChannel, provider }: RegisterCommandOptions): Record<CommandId, any> => ({
	activationCompleted: () => {},
	accountButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("account")

		visibleProvider.postMessageToWebview({ type: "action", action: "accountButtonClicked" })
	},
	plusButtonClicked: async () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("plus")

		await visibleProvider.removeClineFromStack()
		await visibleProvider.postStateToWebview()
		await visibleProvider.postMessageToWebview({ type: "action", action: "chatButtonClicked" })
		// Send focusInput action immediately after chatButtonClicked
		// This ensures the focus happens after the view has switched
		await visibleProvider.postMessageToWebview({ type: "action", action: "focusInput" })
	},
	mcpButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("mcp")

		visibleProvider.postMessageToWebview({ type: "action", action: "mcpButtonClicked" })
	},
	promptsButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("prompts")

		visibleProvider.postMessageToWebview({ type: "action", action: "promptsButtonClicked" })
	},
	popoutButtonClicked: () => {
		TelemetryService.instance.captureTitleButtonClicked("popout")

		return openClineInNewTab({ context, outputChannel })
	},
	openInNewTab: () => openClineInNewTab({ context, outputChannel }),
	settingsButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("settings")

		visibleProvider.postMessageToWebview({ type: "action", action: "settingsButtonClicked" })
		// Also explicitly post the visibility message to trigger scroll reliably
		visibleProvider.postMessageToWebview({ type: "action", action: "didBecomeVisible" })
	},
	historyButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		TelemetryService.instance.captureTitleButtonClicked("history")

		visibleProvider.postMessageToWebview({ type: "action", action: "historyButtonClicked" })
	},
	marketplaceButtonClicked: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)
		if (!visibleProvider) return
		visibleProvider.postMessageToWebview({ type: "action", action: "marketplaceButtonClicked" })
	},
	showHumanRelayDialog: (params: { requestId: string; promptText: string }) => {
		const panel = getPanel()

		if (panel) {
			panel?.webview.postMessage({
				type: "showHumanRelayDialog",
				requestId: params.requestId,
				promptText: params.promptText,
			})
		}
	},
	registerHumanRelayCallback: registerHumanRelayCallback,
	unregisterHumanRelayCallback: unregisterHumanRelayCallback,
	handleHumanRelayResponse: handleHumanRelayResponse,
	newTask: handleNewTask,
	setCustomStoragePath: async () => {
		const { promptForCustomStoragePath } = await import("../utils/storage")
		await promptForCustomStoragePath()
	},
	importSettings: async (filePath?: string) => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)
		if (!visibleProvider) {
			return
		}

		await importSettingsWithFeedback(
			{
				providerSettingsManager: visibleProvider.providerSettingsManager,
				contextProxy: visibleProvider.contextProxy,
				customModesManager: visibleProvider.customModesManager,
				provider: visibleProvider,
			},
			filePath,
		)
	},
	focusInput: async () => {
		try {
			await focusPanel(tabPanel, sidebarPanel)

			// Send focus input message only for sidebar panels
			if (sidebarPanel && getPanel() === sidebarPanel) {
				provider.postMessageToWebview({ type: "action", action: "focusInput" })
			}
		} catch (error) {
			outputChannel.appendLine(`Error focusing input: ${error}`)
		}
	},
	focusPanel: async () => {
		try {
			await focusPanel(tabPanel, sidebarPanel)
		} catch (error) {
			outputChannel.appendLine(`Error focusing panel: ${error}`)
		}
	},
	acceptInput: () => {
		const visibleProvider = getVisibleProviderOrLog(outputChannel)

		if (!visibleProvider) {
			return
		}

		visibleProvider.postMessageToWebview({ type: "acceptInput" })
	},
	toggleDiffAnimations: async () => {
		try {
			const currentSettings = AnimationConfig.getSettings()
			AnimationConfig.updateSettings({ enabled: !currentSettings.enabled })
			await AnimationConfig.saveSettings()

			const status = currentSettings.enabled ? "disabled" : "enabled"
			vscode.window.showInformationMessage(`Diff animations ${status}`)
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to toggle diff animations: ${error.message}`)
		}
	},
	setDiffAnimationSpeed: async () => {
		try {
			const speedOptions = [
				{ label: "Slow", value: "slow" as const },
				{ label: "Normal", value: "normal" as const },
				{ label: "Fast", value: "fast" as const },
				{ label: "Instant", value: "instant" as const },
			]

			const currentSettings = AnimationConfig.getSettings()
			const currentSpeed = currentSettings.speed

			const selectedOption = await vscode.window.showQuickPick(speedOptions, {
				placeHolder: `Select animation speed (current: ${currentSpeed})`,
				canPickMany: false,
			})

			if (selectedOption) {
				AnimationConfig.updateSettings({ speed: selectedOption.value })
				await AnimationConfig.saveSettings()
				vscode.window.showInformationMessage(`Animation speed set to ${selectedOption.label.toLowerCase()}`)
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to set animation speed: ${error.message}`)
		}
	},
	toggleAutoScroll: async () => {
		try {
			const currentSettings = AnimationConfig.getSettings()
			const newAutoScrollEnabled = !currentSettings.autoScroll.enabled

			AnimationConfig.updateSettings({
				autoScroll: {
					...currentSettings.autoScroll,
					enabled: newAutoScrollEnabled,
				},
			})
			await AnimationConfig.saveSettings()

			const status = newAutoScrollEnabled ? "enabled" : "disabled"
			vscode.window.showInformationMessage(`Auto-scroll ${status}`)
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to toggle auto-scroll: ${error.message}`)
		}
	},
	configureAutoScroll: async () => {
		try {
			const currentSettings = AnimationConfig.getSettings()

			const speedOptions = [
				{ label: "Very Slow (2 lines/sec)", value: 2 },
				{ label: "Slow (5 lines/sec)", value: 5 },
				{ label: "Normal (10 lines/sec)", value: 10 },
				{ label: "Fast (20 lines/sec)", value: 20 },
				{ label: "Very Fast (50 lines/sec)", value: 50 },
			]

			const selectedSpeed = await vscode.window.showQuickPick(speedOptions, {
				placeHolder: `Select auto-scroll speed (current: ${currentSettings.autoScroll.maxSpeed} lines/sec)`,
				canPickMany: false,
			})

			if (selectedSpeed) {
				AnimationConfig.updateSettings({
					autoScroll: {
						...currentSettings.autoScroll,
						maxSpeed: selectedSpeed.value,
					},
				})
				await AnimationConfig.saveSettings()
				vscode.window.showInformationMessage(`Auto-scroll speed set to ${selectedSpeed.label}`)
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to configure auto-scroll: ${error.message}`)
		}
	},
	toggleAnimationEffect: async () => {
		try {
			const currentSettings = AnimationConfig.getSettings()

			const effectOptions = [
				{ label: "Typewriter Effect", key: "typewriter" as const, enabled: currentSettings.effects.typewriter },
				{ label: "Fade-in Animations", key: "fadeIn" as const, enabled: currentSettings.effects.fadeIn },
				{
					label: "Highlight Animations",
					key: "highlights" as const,
					enabled: currentSettings.effects.highlights,
				},
				{
					label: "Pulse Active Line",
					key: "pulseActive" as const,
					enabled: currentSettings.effects.pulseActive,
				},
				{
					label: "Smooth Scrolling",
					key: "smoothScrolling" as const,
					enabled: currentSettings.effects.smoothScrolling,
				},
				{
					label: "Progress Indicators",
					key: "progressIndicators" as const,
					enabled: currentSettings.effects.progressIndicators,
				},
			]

			const selectedEffect = await vscode.window.showQuickPick(
				effectOptions.map((option) => ({
					...option,
					description: option.enabled ? "Currently enabled" : "Currently disabled",
				})),
				{
					placeHolder: "Select animation effect to toggle",
					canPickMany: false,
				},
			)

			if (selectedEffect) {
				const newEffects = {
					...currentSettings.effects,
					[selectedEffect.key]: !selectedEffect.enabled,
				}

				AnimationConfig.updateSettings({ effects: newEffects })
				await AnimationConfig.saveSettings()

				const status = selectedEffect.enabled ? "disabled" : "enabled"
				vscode.window.showInformationMessage(`${selectedEffect.label} ${status}`)
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to toggle animation effect: ${error.message}`)
		}
	},
	applyAnimationPreset: async () => {
		try {
			const presetOptions = [
				{
					label: "Performance Mode",
					description: "Optimized for low-end devices",
					preset: AnimationConfig.getPerformanceSettings(),
				},
				{
					label: "Accessibility Mode",
					description: "Reduced motion for accessibility",
					preset: AnimationConfig.getAccessibilitySettings(),
				},
				{
					label: "Default Settings",
					description: "Reset to default configuration",
					preset: AnimationConfig.getSettings(), // This will get defaults if we reset first
				},
			]

			const selectedPreset = await vscode.window.showQuickPick(presetOptions, {
				placeHolder: "Select animation preset",
				canPickMany: false,
			})

			if (selectedPreset) {
				if (selectedPreset.label === "Default Settings") {
					AnimationConfig.resetToDefaults()
				} else {
					AnimationConfig.updateSettings(selectedPreset.preset)
				}
				await AnimationConfig.saveSettings()
				vscode.window.showInformationMessage(`Applied ${selectedPreset.label}`)
			}
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to apply animation preset: ${error.message}`)
		}
	},
	showAnimationStats: async () => {
		try {
			const currentSettings = AnimationConfig.getSettings()

			const stats = [
				`Animation Status: ${currentSettings.enabled ? "Enabled" : "Disabled"}`,
				`Speed: ${currentSettings.speed}`,
				`Auto-scroll: ${currentSettings.autoScroll.enabled ? "Enabled" : "Disabled"}`,
				`Auto-scroll Speed: ${currentSettings.autoScroll.maxSpeed} lines/sec`,
				`Adaptive Speed: ${currentSettings.autoScroll.adaptiveSpeed ? "Yes" : "No"}`,
				``,
				`Active Effects:`,
				`• Typewriter: ${currentSettings.effects.typewriter ? "✓" : "✗"}`,
				`• Fade-in: ${currentSettings.effects.fadeIn ? "✓" : "✗"}`,
				`• Highlights: ${currentSettings.effects.highlights ? "✓" : "✗"}`,
				`• Pulse Active: ${currentSettings.effects.pulseActive ? "✓" : "✗"}`,
				`• Smooth Scrolling: ${currentSettings.effects.smoothScrolling ? "✓" : "✗"}`,
				`• Progress Indicators: ${currentSettings.effects.progressIndicators ? "✓" : "✗"}`,
			].join("\n")

			await vscode.window.showInformationMessage("Diff Animation Settings", { modal: true, detail: stats })
		} catch (error) {
			vscode.window.showErrorMessage(`Failed to show animation stats: ${error.message}`)
		}
	},
})

export const openClineInNewTab = async ({ context, outputChannel }: Omit<RegisterCommandOptions, "provider">) => {
	// (This example uses webviewProvider activation event which is necessary to
	// deserialize cached webview, but since we use retainContextWhenHidden, we
	// don't need to use that event).
	// https://github.com/microsoft/vscode-extension-samples/blob/main/webview-sample/src/extension.ts
	const contextProxy = await ContextProxy.getInstance(context)
	const codeIndexManager = CodeIndexManager.getInstance(context)

	// Get the existing MDM service instance to ensure consistent policy enforcement
	let mdmService: MdmService | undefined
	try {
		mdmService = MdmService.getInstance()
	} catch (error) {
		// MDM service not initialized, which is fine - extension can work without it
		mdmService = undefined
	}

	const tabProvider = new ClineProvider(context, outputChannel, "editor", contextProxy, mdmService)
	const lastCol = Math.max(...vscode.window.visibleTextEditors.map((editor) => editor.viewColumn || 0))

	// Check if there are any visible text editors, otherwise open a new group
	// to the right.
	const hasVisibleEditors = vscode.window.visibleTextEditors.length > 0

	if (!hasVisibleEditors) {
		await vscode.commands.executeCommand("workbench.action.newGroupRight")
	}

	const targetCol = hasVisibleEditors ? Math.max(lastCol + 1, 1) : vscode.ViewColumn.Two

	const newPanel = vscode.window.createWebviewPanel(ClineProvider.tabPanelId, "Roo Code", targetCol, {
		enableScripts: true,
		retainContextWhenHidden: true,
		localResourceRoots: [context.extensionUri],
	})

	// Save as tab type panel.
	setPanel(newPanel, "tab")

	// TODO: Use better svg icon with light and dark variants (see
	// https://stackoverflow.com/questions/58365687/vscode-extension-iconpath).
	newPanel.iconPath = {
		light: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "panel_light.png"),
		dark: vscode.Uri.joinPath(context.extensionUri, "assets", "icons", "panel_dark.png"),
	}

	await tabProvider.resolveWebviewView(newPanel)

	// Add listener for visibility changes to notify webview
	newPanel.onDidChangeViewState(
		(e) => {
			const panel = e.webviewPanel
			if (panel.visible) {
				panel.webview.postMessage({ type: "action", action: "didBecomeVisible" }) // Use the same message type as in SettingsView.tsx
			}
		},
		null, // First null is for `thisArgs`
		context.subscriptions, // Register listener for disposal
	)

	// Handle panel closing events.
	newPanel.onDidDispose(
		() => {
			setPanel(undefined, "tab")
		},
		null,
		context.subscriptions, // Also register dispose listener
	)

	// Lock the editor group so clicking on files doesn't open them over the panel.
	await delay(100)
	await vscode.commands.executeCommand("workbench.action.lockEditorGroup")

	return tabProvider
}

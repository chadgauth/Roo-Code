import React from "react"
import { vscode } from "../../../utils/vscode"
import styles from "./ChatTextArea.module.css"

interface ChatTextAreaActionsProps {
	textAreaDisabled: boolean
	shouldDisableImages: boolean
	isEnhancingPrompt: boolean
	inputValue: string
	setInputValue: (value: string) => void
	onSelectImages: () => void
	onSend: () => void
}

const ChatTextAreaActions: React.FC<ChatTextAreaActionsProps> = ({
	textAreaDisabled,
	shouldDisableImages,
	isEnhancingPrompt,
	inputValue,
	setInputValue,
	onSelectImages,
	onSend,
}) => {
	const handleEnhancePrompt = () => {
		if (!textAreaDisabled) {
			const trimmedInput = inputValue.trim()
			if (trimmedInput) {
				const message = {
					type: "enhancePrompt" as const,
					text: trimmedInput,
				}
				vscode.postMessage(message)
			} else {
				const promptDescription =
					"The 'Enhance Prompt' button helps improve your prompt by providing additional context, clarification, or rephrasing. Try typing a prompt in here and clicking the button again to see how it works."
				setInputValue(promptDescription)
			}
		}
	}

	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: "2px",
				flexWrap: "wrap",
				justifyContent: "flex-end",
				minWidth: 0,
			}}>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "2px",
					flexShrink: 0,
				}}>
				{isEnhancingPrompt ? (
					<span
						className={`codicon codicon-loading codicon-modifier-spin ${styles["action-button"]}`}
						style={{ fontSize: 16 }}
					/>
				) : (
					<span
						role="button"
						aria-label="enhance prompt"
						data-testid="enhance-prompt-button"
						onClick={() => !textAreaDisabled && handleEnhancePrompt()}
						style={{ fontSize: 16 }}
						className={`codicon codicon-sparkle ${styles["action-button"]} ${textAreaDisabled ? styles.disabled : ""}`}
					/>
				)}
			</div>
			<span
				role="button"
				aria-label="select images"
				className={`codicon codicon-device-camera ${styles["action-button"]} ${shouldDisableImages ? styles.disabled : ""}`}
				onClick={() => !shouldDisableImages && onSelectImages()}
				style={{ fontSize: 16 }}
			/>
			<span
				role="button"
				aria-label="send message"
				className={`codicon codicon-send ${styles["action-button"]} ${textAreaDisabled ? styles.disabled : ""}`}
				onClick={() => !textAreaDisabled && onSend()}
				style={{ fontSize: 16 }}
			/>
		</div>
	)
}

export default ChatTextAreaActions

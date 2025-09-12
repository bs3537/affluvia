#!/bin/bash

# Claude Code Undo System
# This script provides easy undo/revert functionality for Claude Code sessions

show_help() {
    cat << EOF
╔════════════════════════════════════════════════════╗
║          Claude Code Undo System                   ║
╠════════════════════════════════════════════════════╣
║ Commands:                                          ║
║   undo        - Revert to last Claude checkpoint   ║
║   undo list   - Show all available checkpoints     ║
║   undo <num>  - Revert to specific checkpoint      ║
║   undo help   - Show this help message            ║
╚════════════════════════════════════════════════════╝

Usage Examples:
  ./claude-undo.sh undo        # Undo last Claude changes
  ./claude-undo.sh undo list    # See all checkpoints
  ./claude-undo.sh undo 2       # Revert to checkpoint #2

Tip: Add alias to your ~/.zshrc or ~/.bashrc:
  alias undo='~/Desktop/affluvia/affluvia/claude-undo.sh undo'
EOF
}

create_checkpoint() {
    echo "📍 Creating checkpoint..."
    git add -A 2>/dev/null
    git stash push -m "CLAUDE_CHECKPOINT_$(date +%Y%m%d_%H%M%S): $1" &>/dev/null
    git stash apply &>/dev/null
    echo "✅ Checkpoint created"
}

list_checkpoints() {
    echo "╔════════════════════════════════════════════════════╗"
    echo "║          Available Claude Checkpoints              ║"
    echo "╚════════════════════════════════════════════════════╝"
    echo ""
    
    checkpoints=$(git stash list 2>/dev/null | grep CLAUDE_CHECKPOINT)
    
    if [ -z "$checkpoints" ]; then
        echo "❌ No checkpoints found"
        echo ""
        echo "Checkpoints are created automatically when Claude makes changes."
        echo "You can also create one manually with: git checkpoint"
    else
        echo "$checkpoints" | nl -v 0 | while IFS= read -r line; do
            # Extract the timestamp and description
            checkpoint_info=$(echo "$line" | sed 's/.*CLAUDE_CHECKPOINT_//')
            echo "$line" | sed 's/CLAUDE_CHECKPOINT_[0-9_]*: //'
        done
    fi
}

undo_to_checkpoint() {
    local checkpoint_num=$1
    
    if [ -z "$checkpoint_num" ]; then
        # Undo to most recent checkpoint
        checkpoint=$(git stash list 2>/dev/null | grep CLAUDE_CHECKPOINT | head -1 | cut -d: -f1)
        checkpoint_desc="most recent checkpoint"
    else
        # Undo to specific checkpoint
        checkpoint=$(git stash list 2>/dev/null | grep CLAUDE_CHECKPOINT | sed -n "$((checkpoint_num+1))p" | cut -d: -f1)
        checkpoint_desc="checkpoint #$checkpoint_num"
    fi
    
    if [ -n "$checkpoint" ]; then
        echo "⏮️  Reverting to $checkpoint_desc..."
        
        # Save current state first (in case user wants to redo)
        git add -A 2>/dev/null
        git stash push -m "CLAUDE_REDO_$(date +%Y%m%d_%H%M%S): Before undo" &>/dev/null
        
        # Revert to checkpoint
        git reset --hard &>/dev/null
        git clean -fd &>/dev/null
        git stash apply "$checkpoint" &>/dev/null
        
        echo "✅ Successfully reverted to $checkpoint_desc"
        echo ""
        echo "💡 Tip: Your current state was saved. Use 'git stash list | grep CLAUDE_REDO' to see it."
    else
        echo "❌ No checkpoint found at position $checkpoint_num"
        list_checkpoints
    fi
}

# Main command handler
case "$1" in
    undo)
        case "$2" in
            list)
                list_checkpoints
                ;;
            help)
                show_help
                ;;
            [0-9]*)
                undo_to_checkpoint "$2"
                ;;
            *)
                undo_to_checkpoint
                ;;
        esac
        ;;
    checkpoint)
        create_checkpoint "${2:-Manual checkpoint}"
        ;;
    *)
        show_help
        ;;
esac
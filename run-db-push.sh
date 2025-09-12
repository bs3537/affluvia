#!/usr/bin/expect -f

# Timeout after 30 seconds
set timeout 30

# Start the drizzle-kit push command
spawn npx drizzle-kit push

# Wait for the prompt about achievement_definitions
expect {
    "Is achievement_definitions table created or renamed from another table?" {
        # Send arrow down to select "create table" then Enter
        send "\r"
    }
    timeout {
        puts "Timeout waiting for prompt"
        exit 1
    }
}

# Wait for the next prompt about user_achievements
expect {
    "Is user_achievements table created or renamed from another table?" {
        send "\r"
    }
    timeout {
        # May not appear if already exists
    }
}

# Wait for the next prompt about user_progress
expect {
    "Is user_progress table created or renamed from another table?" {
        send "\r"
    }
    timeout {
        # May not appear if already exists
    }
}

# Wait for the next prompt about section_progress
expect {
    "Is section_progress table created or renamed from another table?" {
        send "\r"
    }
    timeout {
        # May not appear if already exists
    }
}

# Wait for completion
expect {
    "Changes applied" {
        puts "\nDatabase push completed successfully"
    }
    "No changes detected" {
        puts "\nNo changes needed"
    }
    timeout {
        puts "\nOperation completed or timed out"
    }
}

expect eof

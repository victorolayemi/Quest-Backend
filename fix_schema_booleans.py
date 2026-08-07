import re

with open("src/db/schema.ts", "r") as f:
    content = f.read()

# Make sure integer is imported
if "integer" not in content.split("from")[0]:
    content = content.replace("numeric,", "numeric, integer,")
elif "integer" not in content[:200]:
    content = content.replace("numeric", "numeric, integer", 1)

booleans = [
    "verified", "isRead", "isFavorite", "reminderEnabled", "completed", "solved",
    "isEnabled", "isAutoRenewing", "isPrivate", "isForumDisabledGlobally", "isSuspended",
    "canPostForum", "isGuest", "isAdmin", "isBanned", "soundAlerts", "hapticFeedback",
    "music", "allNotifications", "inAppNotifications", "pushDirectMessages",
    "pushCommunityPosts", "pushCommunityForum", "pushConnectionRequests",
    "pushConnectionAccepted", "doNotDisturb", "autoScroll", "reminderMorning",
    "reminderAfternoon", "reminderEvening", "isCommunityRestricted", "registrationOtpEnabled"
]

for b in booleans:
    # Match: \bfield\b: numeric()
    # Match: \bfield\b: numeric("column_name")
    pattern = rf'\b({b})\s*:\s*numeric\(([^)]*)\)'
    
    def repl(m):
        col_name = m.group(2)
        if col_name:
            return f"{m.group(1)}: integer({col_name}, {{ mode: 'boolean' }})"
        else:
            return f"{m.group(1)}: integer({{ mode: 'boolean' }})"
    
    content = re.sub(pattern, repl, content)

with open("src/db/schema.ts", "w") as f:
    f.write(content)

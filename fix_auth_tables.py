with open("src/routes/auth.ts", "r") as f:
    content = f.read()

# Fix imports
content = content.replace("import { user, globalSettings, otpRequest, loginHistory }", "import { user as userTable, globalSettings as globalSettingsTable, otpRequest as otpRequestTable, loginHistory as loginHistoryTable }")

# Fix insert/update table references
content = content.replace("db.insert(user)", "db.insert(userTable)")
content = content.replace("db.update(user)", "db.update(userTable)")

content = content.replace("db.insert(otpRequest)", "db.insert(otpRequestTable)")
content = content.replace("db.update(otpRequest)", "db.update(otpRequestTable)")

content = content.replace("db.insert(loginHistory)", "db.insert(loginHistoryTable)")
content = content.replace("db.update(loginHistory)", "db.update(loginHistoryTable)")

# Fix eq(table.field, variable)
content = content.replace("eq(user.id, user.id)", "eq(userTable.id, user.id)")
content = content.replace("eq(user.id, existingUser.id)", "eq(userTable.id, existingUser.id)")
content = content.replace("eq(otpRequest.id, otpRequest.id)", "eq(otpRequestTable.id, otpRequest.id)")

with open("src/routes/auth.ts", "w") as f:
    f.write(content)

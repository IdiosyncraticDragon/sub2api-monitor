import XCTest

@MainActor
final class Sub2APIWatchdogUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    private func launchResetApp() -> XCUIApplication {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-reset"]
        app.launch()
        return app
    }

    func testEnteringServerEnablesWebLogin() throws {
        let app = launchResetApp()

        let serverField = app.textFields["server-origin-field"]
        XCTAssertTrue(serverField.waitForExistence(timeout: 5))

        let webLogin = app.buttons["web-login-button"]
        XCTAssertFalse(webLogin.isEnabled)

        serverField.tap()
        serverField.typeText("https://agent.example.com")

        XCTAssertTrue(webLogin.isEnabled)
    }

    func testSettingsShowsAppearanceControls() throws {
        let app = launchResetApp()

        let settings = app.buttons["settings-button"]
        XCTAssertTrue(settings.waitForExistence(timeout: 5))
        settings.tap()

        XCTAssertTrue(app.navigationBars["外观设置"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.staticTexts["主题"].exists)
        XCTAssertTrue(app.staticTexts["外观"].exists)
        XCTAssertTrue(app.staticTexts["Widget 样式"].exists)
    }
}

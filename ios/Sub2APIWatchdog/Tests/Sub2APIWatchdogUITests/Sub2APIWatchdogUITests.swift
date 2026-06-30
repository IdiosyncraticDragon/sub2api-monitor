import XCTest

final class Sub2APIWatchdogUITests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    func testLaunchShowsConnectionControls() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-reset"]
        app.launch()

        XCTAssertTrue(app.navigationBars["Sub2API Watchdog"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.textFields["server-origin-field"].exists)
        XCTAssertTrue(app.secureTextFields["bearer-token-field"].exists)
        XCTAssertTrue(app.buttons["web-login-button"].exists)
        XCTAssertTrue(app.buttons["save-token-button"].exists)
        XCTAssertTrue(app.buttons["clear-token-button"].exists)
    }

    func testEnteringServerEnablesWebLogin() throws {
        let app = XCUIApplication()
        app.launchArguments = ["--ui-testing-reset"]
        app.launch()

        let serverField = app.textFields["server-origin-field"]
        XCTAssertTrue(serverField.waitForExistence(timeout: 5))

        let webLogin = app.buttons["web-login-button"]
        XCTAssertFalse(webLogin.isEnabled)

        serverField.tap()
        serverField.typeText("https://agent.example.com")

        XCTAssertTrue(webLogin.isEnabled)
    }
}

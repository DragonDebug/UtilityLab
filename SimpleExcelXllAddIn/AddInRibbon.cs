using System.Windows.Forms;
using ExcelDna.Integration.CustomUI;

namespace SimpleExcelXllAddIn;

public class AddInRibbon : ExcelRibbon
{
    public override string GetCustomUI(string ribbonId)
    {
        return """
            <customUI xmlns="http://schemas.microsoft.com/office/2009/07/customui">
              <ribbon>
                <tabs>
                  <tab id="utilityLabTab" label="Utility Lab">
                    <group id="utilityLabGroup" label="Add-In Tools">
                      <button
                        id="showFunctionsButton"
                        label="Show Functions"
                        size="large"
                        imageMso="FunctionWizard"
                        screentip="Show add-in functions"
                        supertip="Displays the functions included in this Utility Lab add-in."
                        onAction="OnShowFunctions" />
                    </group>
                  </tab>
                </tabs>
              </ribbon>
            </customUI>
            """;
    }

    public void OnShowFunctions(IRibbonControl control)
    {
        MessageBox.Show(
            "Available functions:\n\n" +
            "UL.ADD_NUMBERS(a, b) - Adds two numbers.\n" +
            "UL.HELLO(name) - Returns a greeting.",
            "Utility Lab Add-In",
            MessageBoxButtons.OK,
            MessageBoxIcon.Information);
    }
}
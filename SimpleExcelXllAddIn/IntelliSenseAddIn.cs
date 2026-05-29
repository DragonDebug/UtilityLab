using ExcelDna.Integration;
using ExcelDna.IntelliSense;

namespace SimpleExcelXllAddIn;

public class IntelliSenseAddIn : IExcelAddIn
{
    public void AutoOpen()
    {
        IntelliSenseServer.Install();
    }

    public void AutoClose()
    {
        IntelliSenseServer.Uninstall();
    }
}
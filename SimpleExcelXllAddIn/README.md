# SimpleExcelXllAddIn

A minimal Excel XLL add-in built with C# and Excel-DNA.

## What it includes

- `UL.ADD_NUMBERS(a, b)` returns the sum of two numbers.
- `UL.HELLO(name)` returns a greeting string.
- A `Utility Lab` ribbon tab with a `Show Functions` button.

## Prerequisites

- Windows desktop Excel
- .NET 8 SDK to build the project
- .NET 8 Desktop Runtime installed on any machine that will load the add-in

## Build

From this folder, run:

```powershell
dotnet restore
dotnet build -c Release
```

Excel-DNA will generate one or more `.xll` files under `bin\Release\net8.0-windows\`. Use the XLL that matches your Excel bitness.

## Load in Excel

1. Open Excel.
2. Go to `File > Options > Add-ins`.
3. In the `Manage` dropdown, choose `Excel Add-ins`, then select `Go...`.
4. Select `Browse...` and pick the generated `.xll` file.
5. In a worksheet, try `=UL.ADD_NUMBERS(2,3)` or `=UL.HELLO("Chris")`.
6. Open the `Utility Lab` ribbon tab and click `Show Functions` to see a quick function summary.

## Notes

- This environment does not have the .NET SDK installed, so the project was scaffolded but not compiled here.
- If you prefer, you can also open the project in Visual Studio and build it there.
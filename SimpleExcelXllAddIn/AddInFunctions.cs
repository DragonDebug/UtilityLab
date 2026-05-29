using ExcelDna.Integration;

namespace SimpleExcelXllAddIn;

public static class AddInFunctions
{
    [ExcelFunction(
        Name = "UL.ADD_NUMBERS",
        Description = "Adds two numbers and returns the result.",
        Category = "Utility Lab")]
    public static double AddNumbers(
        [ExcelArgument(Name = "a", Description = "The first number to add.")] double a,
        [ExcelArgument(Name = "b", Description = "The second number to add.")] double b)
    {
        return a + b;
    }

    [ExcelFunction(
        Name = "UL.HELLO",
        Description = "Returns a greeting from the Utility Lab Excel add-in.",
        Category = "Utility Lab")]
    public static string HelloFromXll(
        [ExcelArgument(Name = "name", Description = "Optional name to include in the greeting.")] string? name)
    {
        return string.IsNullOrWhiteSpace(name)
            ? "Hello from your C# XLL add-in"
            : $"Hello, {name}";
    }
}
// Existing imports
// ...

let finalProvidedPassword; // Declare variable before the transaction

async function crearCredenciales(...) {
    // ... your existing code
    finalProvidedPassword = ...; // Assign inside the function
    // ...
}

async function someOtherFunction() {
    // Transaction starts
    await someDatabaseOperation();
    // Transaction logic
    // ...
    // Call to emailService after transaction completion
    await emailService.sendPassword(finalProvidedPassword);
}
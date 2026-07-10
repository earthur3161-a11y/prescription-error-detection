/**
 * GET /cds-services — CDS Hooks discovery endpoint.
 * Lists the screening service an EHR can invoke on order-select / order-sign.
 * Public by convention (no auth on discovery); the service invocation itself
 * is authenticated.
 */
export async function GET() {
  return Response.json({
    services: [
      {
        hook: "order-sign",
        id: "mediguard-screen",
        title: "MediGuard prescription screening",
        description:
          "Screens each drug order for allergy, interaction, duplicate therapy, dose, contraindication and Ghana EML issues, returning interruptive cards.",
        prefetch: {
          patient: "Patient/{{context.patientId}}",
          allergies: "AllergyIntolerance?patient={{context.patientId}}",
          meds: "MedicationStatement?patient={{context.patientId}}",
        },
      },
    ],
  });
}

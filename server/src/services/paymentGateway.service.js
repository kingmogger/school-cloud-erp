/**
 * Pluggable Payment Gateway interface.
 * Currently implements ManualBillingProvider; future providers (Stripe, Razorpay)
 * can implement the same { createCheckout, verifyWebhook, recordPayment } contract.
 */
export class ManualBillingProvider {
  async createCheckout({ school, plan }) {
    return {
      provider: 'manual',
      instructions: `Transfer $${plan.price} and reference School Code ${school.code}`,
    };
  }

  async verifyPayment({ reference }) {
    return { verified: true, reference: reference || `MANUAL-${Date.now()}` };
  }
}

export const paymentGateway = new ManualBillingProvider();

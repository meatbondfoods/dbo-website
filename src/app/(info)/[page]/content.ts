interface Info { title: string; intro?: string; sections: { heading: string; body: string[] }[]; notice?: string }

const LEGAL_NOTICE = "Draft text for the demo. It must be reviewed by the business and legal counsel before launch.";

export const PAGES: Record<string, Info> = {
  about: {
    title: "About MeatBond Foods",
    intro: "MeatBond Mart is the shopping brand of MeatBond Foods, a Bangladesh meat and poultry processor.",
    sections: [
      { heading: "What we do", body: ["We process, pack and deliver chicken, meat and ready-to-cook foods, handled with care from our facility to your door."] },
      { heading: "Our standards", body: ["Products are weighed to order and dispatched chilled. Order records are kept for every sale."] },
    ],
    notice: "Draft company description: the business should confirm and expand this before launch.",
  },
  contact: {
    title: "Contact us",
    intro: "Questions about an order or a product? We're happy to help.",
    sections: [
      { heading: "Get in touch", body: ["{{CONTACT_DETAILS}}", "For an existing order, use Track an order with your order number and mobile number."] },
    ],
    notice: "Contact details are managed in the admin panel (Site and contact). Add the real details before launch.",
  },
  faqs: {
    title: "Frequently asked questions",
    sections: [
      { heading: "How are products kept fresh?", body: ["Products are packed to order and dispatched chilled."] },
      { heading: "Which areas do you deliver to?", body: ["We currently deliver within Dhaka. See Delivery information for charges and timings."] },
      { heading: "What payment methods are accepted?", body: ["Cash on delivery is available. Online payment options are planned."] },
      { heading: "Can I change or cancel an order?", body: ["Contact us as soon as possible. Orders can be changed until they are packed."] },
    ],
  },
  "delivery-information": {
    title: "Delivery information",
    sections: [
      { heading: "Charges", body: ["{{DELIVERY_RULE}}"] },
      { heading: "Timing", body: ["Orders confirmed before noon are delivered the same day within Dhaka. Later orders go out the next morning."] },
      { heading: "On arrival", body: ["Orders are delivered chilled. Please refrigerate or freeze products as soon as they arrive."] },
    ],
    notice: "Delivery charges come from the admin-managed delivery settings. The free-delivery radius, charge and area distances are unconfirmed sample values; confirm with operations before launch.",
  },
  "privacy-policy": {
    title: "Privacy policy",
    sections: [
      { heading: "What we collect", body: ["Name, mobile number, delivery address and order details, used only to fulfil and support your orders."] },
      { heading: "How we use it", body: ["We do not sell personal data. Information is shared only with delivery staff and service providers needed to complete your order."] },
      { heading: "Your rights", body: ["You can ask us to correct or delete your personal information by contacting us."] },
    ],
    notice: LEGAL_NOTICE,
  },
  terms: {
    title: "Terms & conditions",
    sections: [
      { heading: "Orders", body: ["Placing an order is an offer to buy. We confirm orders by phone and may decline orders if stock is unavailable."] },
      { heading: "Prices & weights", body: ["Prices are in Bangladeshi Taka. Fresh products vary slightly in weight; we pack as close to the selected weight as possible."] },
      { heading: "Returns", body: ["Because products are perishable, report any quality issue within 2 hours of delivery with a photo."] },
    ],
    notice: LEGAL_NOTICE,
  },
};

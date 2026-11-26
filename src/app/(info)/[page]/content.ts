interface Info { title: string; intro?: string; sections: { heading: string; body: string[] }[]; notice?: string }

export const PAGES: Record<string, Info> = {
  about: {
    title: "About MeatBond Foods",
    intro: "MeatBond Mart is the direct-to-home storefront of MeatBond Foods — a modern, cold-chain certified meat & poultry processor in Chattogram, Bangladesh.",
    sections: [
      { heading: "What we do", body: ["We source, process, vacuum-pack, and deliver 100% Halal poultry, meat cuts, and ready-to-cook selections straight from our hygienically controlled facility to your kitchen."] },
      { heading: "Our standards", body: ["Every pack is strictly weighed to order, temperature-monitored from processing to dispatch, and tracked end-to-end with complete batch traceability."] },
    ],
  },
  contact: {
    title: "Contact us",
    intro: "Questions about cuts, bulk orders, or an active delivery? Our customer team is ready to assist you.",
    sections: [
      { heading: "Get in touch", body: ["{{CONTACT_DETAILS}}", "To check the status of a live order anytime, use Track an order with your order reference and mobile number."] },
    ],
  },
  faqs: {
    title: "Frequently asked questions",
    sections: [
      { heading: "How are products kept fresh?", body: ["Every pack is processed hygienically, vacuum-sealed, and dispatched in temperature-controlled insulated packaging — never left sitting open in warm markets."] },
      { heading: "Which areas do you deliver to?", body: ["We deliver across Chattogram. Check our Delivery information page for exact charges and dispatch windows."] },
      { heading: "What payment methods are accepted?", body: ["Cash on delivery, bKash, Nagad, and Card on delivery are supported when your order arrives."] },
      { heading: "Can I change or cancel an order?", body: ["Contact our support team as soon as possible. Orders can be modified before cold-chain dispatch begins."] },
    ],
  },
  "delivery-information": {
    title: "Delivery information",
    sections: [
      { heading: "Charges", body: ["{{DELIVERY_RULE}}"] },
      { heading: "Timing", body: ["Orders confirmed before 12:00 PM are eligible for same-day chilled dispatch within Chattogram. Afternoon and evening orders go out on the next morning dispatch run."] },
      { heading: "On arrival", body: ["Please inspect your sealed packs upon arrival and refrigerate or freeze immediately to maintain peak freshness."] },
    ],
  },
  "privacy-policy": {
    title: "Privacy policy",
    sections: [
      { heading: "What we collect", body: ["Your name, mobile number, delivery address, and order details — used strictly to prepare, confirm, and deliver your orders."] },
      { heading: "How we use it", body: ["MeatBond Foods never sells personal data. Delivery details are shared solely with our authorized MeatBond dispatch riders to fulfill your order."] },
      { heading: "Your rights", body: ["You can request updates or deletion of your account information anytime through our customer support team."] },
    ],
  },
  terms: {
    title: "Terms & conditions",
    sections: [
      { heading: "Orders", body: ["Submitting an order initiates confirmation with our dispatch team based on live facility inventory and delivery zone availability."] },
      { heading: "Prices & weights", body: ["All prices are listed in Bangladeshi Taka (৳). Fresh chilled cuts are weighed accurately to match your selected pack size."] },
      { heading: "Quality guarantee", body: ["Your satisfaction comes first. If there is any packaging or quality issue upon arrival, report it within 2 hours of delivery with a photo for immediate resolution."] },
    ],
  },
};

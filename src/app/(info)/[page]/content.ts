interface Info { title: string; intro?: string; sections: { heading: string; body: string[] }[]; notice?: string }

const LEGAL_NOTICE = "Draft text for the demo. It must be reviewed by the business and legal counsel before launch.";

export const PAGES: Record<string, Info> = {
  about: {
    title: "About MeatBond Foods",
    intro: "MeatBond Mart is the shopping brand of MeatBond Foods, a Bangladesh meat and poultry processor.",
    sections: [
      { heading: "What we do", body: ["We process, pack and deliver fresh chicken, beef, mutton and ready-to-cook foods with a strict cold chain from facility to doorstep."] },
      { heading: "Our standards", body: ["Every pack is traceable to its processing batch. Products are chilled, weighed to order and dispatched in temperature-controlled vehicles."] },
    ],
  },
  contact: {
    title: "Contact us",
    intro: "Questions about an order or a product? We're happy to help.",
    sections: [
      { heading: "Get in touch", body: ["Phone, email and address details will be published here once confirmed by the business.", "For an existing order, use Track an order with your order number and mobile number."] },
    ],
    notice: "Contact details are placeholders: add the real phone, email and address before launch.",
  },
  faqs: {
    title: "Frequently asked questions",
    sections: [
      { heading: "How fresh is the meat?", body: ["Products are processed daily and kept chilled at 0-4°C until dispatch."] },
      { heading: "Which areas do you deliver to?", body: ["We currently deliver within Dhaka. See Delivery information for charges and timings."] },
      { heading: "What payment methods are accepted?", body: ["Cash on delivery is available. Online payment options are planned."] },
      { heading: "Can I change or cancel an order?", body: ["Contact us as soon as possible. Orders can be changed until they are packed."] },
    ],
  },
  "delivery-information": {
    title: "Delivery information",
    sections: [
      { heading: "Charges", body: ["Delivery is ৳80 per order, free on orders of ৳1,500 or more."] },
      { heading: "Timing", body: ["Orders confirmed before noon are delivered the same day within Dhaka. Later orders go out the next morning."] },
      { heading: "Cold chain", body: ["Orders travel in insulated, chilled packaging. Please refrigerate or freeze on arrival."] },
    ],
    notice: "Delivery charge and timings here match the demo settings; confirm with operations before launch.",
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

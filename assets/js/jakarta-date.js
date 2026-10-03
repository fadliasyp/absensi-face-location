(function exposeJakartaDate(global) {
  function getJakartaDateString(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const values = {};

    for (const part of parts) {
      if (part.type !== "literal") {
        values[part.type] = part.value;
      }
    }

    return `${values.year}-${values.month}-${values.day}`;
  }

  global.getJakartaDateString = getJakartaDateString;
})(window);

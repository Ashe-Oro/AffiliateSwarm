/*
 * AffiliateSwarm — storefront attribution capture.
 *
 * 1. On every page load, if ?swarm_ref=XYZ is present and well-formed,
 *    persist it in a 30-day cookie.
 * 2. On checkout link clicks and add-to-cart submissions, write the cookie
 *    value into the cart's note_attributes so it lands on the order webhook.
 */
(function () {
  "use strict";

  var COOKIE_NAME = "swarm_ref";
  var COOKIE_TTL_DAYS = 30;
  var REF_PATTERN = /^[A-Za-z0-9_-]{6,32}$/;

  function setCookie(name, value, days) {
    var maxAge = days * 24 * 60 * 60;
    document.cookie =
      name + "=" + encodeURIComponent(value) + ";path=/;max-age=" + maxAge + ";SameSite=Lax";
  }

  function getCookie(name) {
    var match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
    return match ? decodeURIComponent(match[2]) : null;
  }

  function captureFromUrl() {
    try {
      var params = new URLSearchParams(window.location.search);
      var ref = params.get("swarm_ref");
      if (ref && REF_PATTERN.test(ref)) {
        setCookie(COOKIE_NAME, ref, COOKIE_TTL_DAYS);
      }
    } catch (e) {
      // ignore
    }
  }

  function attachToCart() {
    var ref = getCookie(COOKIE_NAME);
    if (!ref) return Promise.resolve();
    var body = {
      attributes: {
        swarm_ref: ref,
        swarm_source: "theme",
      },
    };
    return fetch("/cart/update.js", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      credentials: "same-origin",
    }).catch(function () {
      /* fire-and-forget */
    });
  }

  captureFromUrl();

  // Attach on add-to-cart form submissions.
  document.addEventListener("submit", function (e) {
    var target = e.target;
    if (
      target &&
      target.tagName === "FORM" &&
      target.action &&
      /\/cart\/add/.test(target.action)
    ) {
      attachToCart();
    }
  });

  // Attach on checkout link clicks (anchor or button).
  document.addEventListener("click", function (e) {
    var node = e.target;
    while (node && node !== document.body) {
      var href = node.getAttribute && node.getAttribute("href");
      var name = node.getAttribute && node.getAttribute("name");
      if ((href && /\/checkout/.test(href)) || name === "checkout") {
        attachToCart();
        return;
      }
      node = node.parentNode;
    }
  });
})();

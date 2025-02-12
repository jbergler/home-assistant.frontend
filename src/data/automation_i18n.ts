import { formatDuration } from "../common/datetime/format_duration";
import secondsToDuration from "../common/datetime/seconds_to_duration";
import { ensureArray } from "../common/array/ensure-array";
import { computeStateName } from "../common/entity/compute_state_name";
import type { HomeAssistant } from "../types";
import { Condition, Trigger, ForDict } from "./automation";
import {
  DeviceCondition,
  DeviceTrigger,
  localizeDeviceAutomationCondition,
  localizeDeviceAutomationTrigger,
} from "./device_automation";
import {
  computeAttributeNameDisplay,
  computeAttributeValueDisplay,
} from "../common/entity/compute_attribute_display";
import { computeStateDisplay } from "../common/entity/compute_state_display";
import { EntityRegistryEntry } from "./entity_registry";

const describeDuration = (forTime: number | string | ForDict) => {
  let duration: string | null;
  if (typeof forTime === "number") {
    duration = secondsToDuration(forTime);
  } else if (typeof forTime === "string") {
    duration = forTime;
  } else {
    duration = formatDuration(forTime);
  }
  return duration;
};

const ordinalSuffix = (n: number) => {
  n %= 100;
  if ([11, 12, 13].includes(n)) {
    return "th";
  }
  if (n % 10 === 1) {
    return "st";
  }
  if (n % 10 === 2) {
    return "nd";
  }
  if (n % 10 === 3) {
    return "rd";
  }
  return "th";
};

export const describeTrigger = (
  trigger: Trigger,
  hass: HomeAssistant,
  entityRegistry: EntityRegistryEntry[],
  ignoreAlias = false
) => {
  if (trigger.alias && !ignoreAlias) {
    return trigger.alias;
  }

  // Event Trigger
  if (trigger.platform === "event" && trigger.event_type) {
    let eventTypes = "";

    if (Array.isArray(trigger.event_type)) {
      for (const [index, state] of trigger.event_type.entries()) {
        eventTypes += `${index > 0 ? "," : ""} ${
          trigger.event_type.length > 1 &&
          index === trigger.event_type.length - 1
            ? "or"
            : ""
        } ${state}`;
      }
    } else {
      eventTypes = trigger.event_type.toString();
    }

    return `When ${eventTypes} event is fired`;
  }

  // Home Assistant Trigger
  if (trigger.platform === "homeassistant" && trigger.event) {
    return `When Home Assistant is ${
      trigger.event === "start" ? "started" : "shutdown"
    }`;
  }

  // Numeric State Trigger
  if (trigger.platform === "numeric_state" && trigger.entity_id) {
    let base = "When";
    const stateObj = hass.states[trigger.entity_id];
    const entity = stateObj ? computeStateName(stateObj) : trigger.entity_id;

    if (trigger.attribute) {
      base += ` ${computeAttributeNameDisplay(
        hass.localize,
        stateObj,
        hass.entities,
        trigger.attribute
      )} from`;
    }

    base += ` ${entity} is`;

    if (trigger.above !== undefined) {
      base += ` above ${trigger.above}`;
    }

    if (trigger.below !== undefined && trigger.above !== undefined) {
      base += " and";
    }

    if (trigger.below !== undefined) {
      base += ` below ${trigger.below}`;
    }

    if (trigger.for) {
      const duration = describeDuration(trigger.for);
      if (duration) {
        base += ` for ${duration}`;
      }
    }

    return base;
  }

  // State Trigger
  if (trigger.platform === "state") {
    let base = "When";
    let entities = "";
    const states = hass.states;

    if (trigger.attribute) {
      const stateObj = Array.isArray(trigger.entity_id)
        ? hass.states[trigger.entity_id[0]]
        : hass.states[trigger.entity_id];
      base += ` ${computeAttributeNameDisplay(
        hass.localize,
        stateObj,
        hass.entities,
        trigger.attribute
      )} of`;
    }

    if (Array.isArray(trigger.entity_id)) {
      for (const [index, entity] of trigger.entity_id.entries()) {
        if (states[entity]) {
          entities += `${index > 0 ? "," : ""} ${
            trigger.entity_id.length > 1 &&
            index === trigger.entity_id.length - 1
              ? "or"
              : ""
          } ${computeStateName(states[entity]) || entity}`;
        }
      }
    } else if (trigger.entity_id) {
      entities = states[trigger.entity_id]
        ? computeStateName(states[trigger.entity_id])
        : trigger.entity_id;
    }

    if (!entities) {
      // no entity_id or empty array
      entities = "something";
    }

    base += ` ${entities} changes`;

    const stateObj =
      hass.states[
        Array.isArray(trigger.entity_id)
          ? trigger.entity_id[0]
          : trigger.entity_id
      ];
    if (trigger.from !== undefined) {
      if (trigger.from === null) {
        if (!trigger.attribute) {
          base += " from any state";
        }
      } else if (Array.isArray(trigger.from)) {
        let from = "";
        for (const [index, state] of trigger.from.entries()) {
          from += `${index > 0 ? "," : ""} ${
            trigger.from.length > 1 && index === trigger.from.length - 1
              ? "or"
              : ""
          } '${
            trigger.attribute
              ? computeAttributeValueDisplay(
                  hass.localize,
                  stateObj,
                  hass.locale,
                  hass.entities,
                  trigger.attribute,
                  state
                )
              : computeStateDisplay(
                  hass.localize,
                  stateObj,
                  hass.locale,
                  hass.entities,
                  state
                )
          }'`;
        }
        if (from) {
          base += ` from ${from}`;
        }
      } else {
        base += ` from '${
          trigger.attribute
            ? computeAttributeValueDisplay(
                hass.localize,
                stateObj,
                hass.locale,
                hass.entities,
                trigger.attribute,
                trigger.from
              ).toString()
            : computeStateDisplay(
                hass.localize,
                stateObj,
                hass.locale,
                hass.entities,
                trigger.from.toString()
              ).toString()
        }'`;
      }
    }

    if (trigger.to !== undefined) {
      if (trigger.to === null) {
        if (!trigger.attribute) {
          base += " to any state";
        }
      } else if (Array.isArray(trigger.to)) {
        let to = "";
        for (const [index, state] of trigger.to.entries()) {
          to += `${index > 0 ? "," : ""} ${
            trigger.to.length > 1 && index === trigger.to.length - 1 ? "or" : ""
          } '${
            trigger.attribute
              ? computeAttributeValueDisplay(
                  hass.localize,
                  stateObj,
                  hass.locale,
                  hass.entities,
                  trigger.attribute,
                  state
                ).toString()
              : computeStateDisplay(
                  hass.localize,
                  stateObj,
                  hass.locale,
                  hass.entities,
                  state
                ).toString()
          }'`;
        }
        if (to) {
          base += ` to ${to}`;
        }
      } else {
        base += ` to '${
          trigger.attribute
            ? computeAttributeValueDisplay(
                hass.localize,
                stateObj,
                hass.locale,
                hass.entities,
                trigger.attribute,
                trigger.to
              ).toString()
            : computeStateDisplay(
                hass.localize,
                stateObj,
                hass.locale,
                hass.entities,
                trigger.to.toString()
              ).toString()
        }'`;
      }
    }

    if (trigger.for) {
      const duration = describeDuration(trigger.for);
      if (duration) {
        base += ` for ${duration}`;
      }
    }

    return base;
  }

  // Sun Trigger
  if (trigger.platform === "sun" && trigger.event) {
    let base = `When the sun ${trigger.event === "sunset" ? "sets" : "rises"}`;

    if (trigger.offset) {
      let duration = "";

      if (trigger.offset) {
        if (typeof trigger.offset === "number") {
          duration = ` offset by ${secondsToDuration(trigger.offset)!}`;
        } else if (typeof trigger.offset === "string") {
          duration = ` offset by ${trigger.offset}`;
        } else {
          duration = ` offset by ${JSON.stringify(trigger.offset)}`;
        }
      }
      base += duration;
    }

    return base;
  }

  // Tag Trigger
  if (trigger.platform === "tag") {
    return "When a tag is scanned";
  }

  // Time Trigger
  if (trigger.platform === "time" && trigger.at) {
    const result = ensureArray(trigger.at).map((at) =>
      at.toString().includes(".")
        ? `entity ${hass.states[at] ? computeStateName(hass.states[at]) : at}`
        : at
    );

    const last = result.splice(-1, 1)[0];
    return `When the time is equal to ${
      result.length ? `${result.join(", ")} or ` : ""
    }${last}`;
  }

  // Time Pattern Trigger
  if (
    trigger.platform === "time_pattern" &&
    (trigger.seconds !== undefined ||
      trigger.minutes !== undefined ||
      trigger.hours !== undefined)
  ) {
    let result = "Trigger ";
    if (trigger.seconds !== undefined) {
      const seconds_all = trigger.seconds === "*";
      const seconds_interval =
        typeof trigger.seconds === "string" && trigger.seconds.startsWith("/");
      const seconds = seconds_all
        ? 0
        : typeof trigger.seconds === "number"
        ? trigger.seconds
        : seconds_interval
        ? parseInt(trigger.seconds.substring(1))
        : parseInt(trigger.seconds);

      if (
        isNaN(seconds) ||
        seconds > 59 ||
        seconds < 0 ||
        (seconds_interval && seconds === 0)
      ) {
        return "Invalid Time Pattern Seconds";
      }

      if (seconds_all) {
        result += "every second of ";
      } else if (seconds_interval) {
        result += `every ${seconds} seconds of `;
      } else {
        result += `on the ${seconds}${ordinalSuffix(seconds)} second of `;
      }
    }
    if (trigger.minutes !== undefined) {
      const minutes_all = trigger.minutes === "*";
      const minutes_interval =
        typeof trigger.minutes === "string" && trigger.minutes.startsWith("/");
      const minutes = minutes_all
        ? 0
        : typeof trigger.minutes === "number"
        ? trigger.minutes
        : minutes_interval
        ? parseInt(trigger.minutes.substring(1))
        : parseInt(trigger.minutes);

      if (
        isNaN(minutes) ||
        minutes > 59 ||
        minutes < 0 ||
        (minutes_interval && minutes === 0)
      ) {
        return "Invalid Time Pattern Minutes";
      }

      if (minutes_all) {
        result += "every minute of ";
      } else if (minutes_interval) {
        result += `every ${minutes} minutes of `;
      } else {
        result += `${
          trigger.seconds !== undefined ? "" : "on"
        } the ${minutes}${ordinalSuffix(minutes)} minute of `;
      }
    } else if (trigger.seconds !== undefined) {
      if (trigger.hours !== undefined) {
        result += `the 0${ordinalSuffix(0)} minute of `;
      } else {
        result += "every minute of ";
      }
    }
    if (trigger.hours !== undefined) {
      const hours_all = trigger.hours === "*";
      const hours_interval =
        typeof trigger.hours === "string" && trigger.hours.startsWith("/");
      const hours = hours_all
        ? 0
        : typeof trigger.hours === "number"
        ? trigger.hours
        : hours_interval
        ? parseInt(trigger.hours.substring(1))
        : parseInt(trigger.hours);

      if (
        isNaN(hours) ||
        hours > 23 ||
        hours < 0 ||
        (hours_interval && hours === 0)
      ) {
        return "Invalid Time Pattern Hours";
      }

      if (hours_all) {
        result += "every hour";
      } else if (hours_interval) {
        result += `every ${hours} hours`;
      } else {
        result += `${
          trigger.seconds !== undefined || trigger.minutes !== undefined
            ? ""
            : "on"
        } the ${hours}${ordinalSuffix(hours)} hour`;
      }
    } else {
      result += "every hour";
    }
    return result;
  }

  // Zone Trigger
  if (trigger.platform === "zone" && trigger.entity_id && trigger.zone) {
    let entities = "";
    let zones = "";
    let zonesPlural = false;

    const states = hass.states;

    if (Array.isArray(trigger.entity_id)) {
      for (const [index, entity] of trigger.entity_id.entries()) {
        if (states[entity]) {
          entities += `${index > 0 ? "," : ""} ${
            trigger.entity_id.length > 1 &&
            index === trigger.entity_id.length - 1
              ? "or"
              : ""
          } ${computeStateName(states[entity]) || entity}`;
        }
      }
    } else {
      entities = states[trigger.entity_id]
        ? computeStateName(states[trigger.entity_id])
        : trigger.entity_id;
    }

    if (Array.isArray(trigger.zone)) {
      if (trigger.zone.length > 1) {
        zonesPlural = true;
      }

      for (const [index, zone] of trigger.zone.entries()) {
        if (states[zone]) {
          zones += `${index > 0 ? "," : ""} ${
            trigger.zone.length > 1 && index === trigger.zone.length - 1
              ? "or"
              : ""
          } ${computeStateName(states[zone]) || zone}`;
        }
      }
    } else {
      zones = states[trigger.zone]
        ? computeStateName(states[trigger.zone])
        : trigger.zone;
    }

    return `When ${entities} ${trigger.event}s ${zones} ${
      zonesPlural ? "zones" : "zone"
    }`;
  }

  // Geo Location Trigger
  if (trigger.platform === "geo_location" && trigger.source && trigger.zone) {
    let sources = "";
    let zones = "";
    let zonesPlural = false;
    const states = hass.states;

    if (Array.isArray(trigger.source)) {
      for (const [index, source] of trigger.source.entries()) {
        sources += `${index > 0 ? "," : ""} ${
          trigger.source.length > 1 && index === trigger.source.length - 1
            ? "or"
            : ""
        } ${source}`;
      }
    } else {
      sources = trigger.source;
    }

    if (Array.isArray(trigger.zone)) {
      if (trigger.zone.length > 1) {
        zonesPlural = true;
      }

      for (const [index, zone] of trigger.zone.entries()) {
        if (states[zone]) {
          zones += `${index > 0 ? "," : ""} ${
            trigger.zone.length > 1 && index === trigger.zone.length - 1
              ? "or"
              : ""
          } ${computeStateName(states[zone]) || zone}`;
        }
      }
    } else {
      zones = states[trigger.zone]
        ? computeStateName(states[trigger.zone])
        : trigger.zone;
    }

    return `When ${sources} ${trigger.event}s ${zones} ${
      zonesPlural ? "zones" : "zone"
    }`;
  }
  // MQTT Trigger
  if (trigger.platform === "mqtt") {
    return "When an MQTT message has been received";
  }

  // Template Trigger
  if (trigger.platform === "template") {
    let base = "When a template triggers";
    if (trigger.for) {
      const duration = describeDuration(trigger.for);
      if (duration) {
        base += ` for ${duration}`;
      }
    }
    return base;
  }

  // Webhook Trigger
  if (trigger.platform === "webhook") {
    return "When a Webhook payload has been received";
  }

  if (trigger.platform === "device") {
    if (!trigger.device_id) {
      return "Device trigger";
    }
    const config = trigger as DeviceTrigger;
    const localized = localizeDeviceAutomationTrigger(
      hass,
      entityRegistry,
      config
    );
    if (localized) {
      return localized;
    }
    const stateObj = hass.states[config.entity_id as string];
    return `${stateObj ? computeStateName(stateObj) : config.entity_id} ${
      config.type
    }`;
  }

  return `${
    trigger.platform ? trigger.platform.replace(/_/g, " ") : "Unknown"
  } trigger`;
};

export const describeCondition = (
  condition: Condition,
  hass: HomeAssistant,
  entityRegistry: EntityRegistryEntry[],
  ignoreAlias = false
) => {
  if (condition.alias && !ignoreAlias) {
    return condition.alias;
  }

  if (!condition.condition) {
    const shorthands: Array<"and" | "or" | "not"> = ["and", "or", "not"];
    for (const key of shorthands) {
      if (!(key in condition)) {
        continue;
      }
      if (ensureArray(condition[key])) {
        condition = {
          condition: key,
          conditions: condition[key],
        };
      }
    }
  }

  if (condition.condition === "or") {
    const conditions = ensureArray(condition.conditions);

    if (!conditions || conditions.length === 0) {
      return "Test if any condition matches";
    }
    const count = conditions.length;
    return `Test if any of ${count} condition${count === 1 ? "" : "s"} matches`;
  }

  if (condition.condition === "and") {
    const conditions = ensureArray(condition.conditions);

    if (!conditions || conditions.length === 0) {
      return "Test if multiple conditions match";
    }
    const count = conditions.length;
    return `Test if ${count} condition${count === 1 ? "" : "s"} match${
      count === 1 ? "es" : ""
    }`;
  }

  if (condition.condition === "not") {
    const conditions = ensureArray(condition.conditions);

    if (!conditions || conditions.length === 0) {
      return "Test if no condition matches";
    }
    if (conditions.length === 1) {
      return "Test if 1 condition does not match";
    }
    return `Test if none of ${conditions.length} conditions match`;
  }

  // State Condition
  if (condition.condition === "state") {
    let base = "Confirm";
    if (!condition.entity_id) {
      return `${base} state`;
    }

    if (condition.attribute) {
      const stateObj = Array.isArray(condition.entity_id)
        ? hass.states[condition.entity_id[0]]
        : hass.states[condition.entity_id];
      base += ` ${computeAttributeNameDisplay(
        hass.localize,
        stateObj,
        hass.entities,
        condition.attribute
      )} of`;
    }

    if (Array.isArray(condition.entity_id)) {
      let entities = "";
      for (const [index, entity] of condition.entity_id.entries()) {
        if (hass.states[entity]) {
          entities += `${index > 0 ? "," : ""} ${
            condition.entity_id.length > 1 &&
            index === condition.entity_id.length - 1
              ? condition.match === "any"
                ? "or"
                : "and"
              : ""
          } ${computeStateName(hass.states[entity]) || entity}`;
        }
      }
      if (entities) {
        base += ` ${entities} ${condition.entity_id.length > 1 ? "are" : "is"}`;
      } else {
        // no entity_id or empty array
        base += " an entity";
      }
    } else if (condition.entity_id) {
      base += ` ${
        hass.states[condition.entity_id]
          ? computeStateName(hass.states[condition.entity_id])
          : condition.entity_id
      } is`;
    }

    let states = "";
    const stateObj =
      hass.states[
        Array.isArray(condition.entity_id)
          ? condition.entity_id[0]
          : condition.entity_id
      ];
    if (Array.isArray(condition.state)) {
      for (const [index, state] of condition.state.entries()) {
        states += `${index > 0 ? "," : ""} ${
          condition.state.length > 1 && index === condition.state.length - 1
            ? "or"
            : ""
        } '${
          condition.attribute
            ? computeAttributeValueDisplay(
                hass.localize,
                stateObj,
                hass.locale,
                hass.entities,
                condition.attribute,
                state
              )
            : computeStateDisplay(
                hass.localize,
                stateObj,
                hass.locale,
                hass.entities,
                state
              )
        }'`;
      }
    } else if (condition.state !== "") {
      states = `'${
        condition.attribute
          ? computeAttributeValueDisplay(
              hass.localize,
              stateObj,
              hass.locale,
              hass.entities,
              condition.attribute,
              condition.state
            ).toString()
          : computeStateDisplay(
              hass.localize,
              stateObj,
              hass.locale,
              hass.entities,
              condition.state.toString()
            ).toString()
      }'`;
    }

    if (!states) {
      states = "a state";
    }

    base += ` ${states}`;

    if (condition.for) {
      const duration = describeDuration(condition.for);
      if (duration) {
        base += ` for ${duration}`;
      }
    }

    return base;
  }

  // Numeric State Condition
  if (condition.condition === "numeric_state" && condition.entity_id) {
    let base = "Confirm";
    const stateObj = hass.states[condition.entity_id];
    const entity = stateObj ? computeStateName(stateObj) : condition.entity_id;

    if ("attribute" in condition) {
      base += ` ${condition.attribute} from`;
    }

    base += ` ${entity} is`;

    if ("above" in condition) {
      base += ` above ${condition.above}`;
    }

    if ("below" in condition && "above" in condition) {
      base += " and";
    }

    if ("below" in condition) {
      base += ` below ${condition.below}`;
    }

    return base;
  }

  // Time condition
  if (condition.condition === "time") {
    const weekdaysArray = ensureArray(condition.weekday);
    const validWeekdays =
      weekdaysArray && weekdaysArray.length > 0 && weekdaysArray.length < 7;
    if (condition.before || condition.after || validWeekdays) {
      const before = condition.before?.toString().includes(".")
        ? `entity ${
            hass.states[condition.before]
              ? computeStateName(hass.states[condition.before])
              : condition.before
          }`
        : condition.before;

      const after = condition.after?.toString().includes(".")
        ? `entity ${
            hass.states[condition.after]
              ? computeStateName(hass.states[condition.after])
              : condition.after
          }`
        : condition.after;

      let result = "Confirm the ";
      if (after || before) {
        result += "time is ";
      }
      if (after) {
        result += "after " + after;
      }
      if (before && after) {
        result += " and ";
      }
      if (before) {
        result += "before " + before;
      }
      if ((after || before) && validWeekdays) {
        result += " and the ";
      }
      if (validWeekdays) {
        const localizedDays = weekdaysArray.map((d) =>
          hass.localize(
            `ui.panel.config.automation.editor.conditions.type.time.weekdays.${d}`
          )
        );
        const last = localizedDays.pop();

        result += " day is " + localizedDays.join(", ");

        if (localizedDays.length) {
          if (localizedDays.length > 1) {
            result += ",";
          }
          result += " or ";
        }
        result += last;
      }

      return result;
    }
  }

  // Sun condition
  if (
    condition.condition === "sun" &&
    ("before" in condition || "after" in condition)
  ) {
    let base = "Confirm";

    if (!condition.after && !condition.before) {
      base += " sun";
      return base;
    }

    base += " sun";

    if (condition.after) {
      let duration = "";

      if (condition.after_offset) {
        if (typeof condition.after_offset === "number") {
          duration = ` offset by ${secondsToDuration(condition.after_offset)!}`;
        } else if (typeof condition.after_offset === "string") {
          duration = ` offset by ${condition.after_offset}`;
        } else {
          duration = ` offset by ${JSON.stringify(condition.after_offset)}`;
        }
      }

      base += ` after ${condition.after}${duration}`;
    }

    if (condition.before) {
      base += ` before ${condition.before}`;
    }

    return base;
  }

  // Zone condition
  if (condition.condition === "zone" && condition.entity_id && condition.zone) {
    let entities = "";
    let entitiesPlural = false;
    let zones = "";
    let zonesPlural = false;

    const states = hass.states;

    if (Array.isArray(condition.entity_id)) {
      if (condition.entity_id.length > 1) {
        entitiesPlural = true;
      }
      for (const [index, entity] of condition.entity_id.entries()) {
        if (states[entity]) {
          entities += `${index > 0 ? "," : ""} ${
            condition.entity_id.length > 1 &&
            index === condition.entity_id.length - 1
              ? "or"
              : ""
          } ${computeStateName(states[entity]) || entity}`;
        }
      }
    } else {
      entities = states[condition.entity_id]
        ? computeStateName(states[condition.entity_id])
        : condition.entity_id;
    }

    if (Array.isArray(condition.zone)) {
      if (condition.zone.length > 1) {
        zonesPlural = true;
      }

      for (const [index, zone] of condition.zone.entries()) {
        if (states[zone]) {
          zones += `${index > 0 ? "," : ""} ${
            condition.zone.length > 1 && index === condition.zone.length - 1
              ? "or"
              : ""
          } ${computeStateName(states[zone]) || zone}`;
        }
      }
    } else {
      zones = states[condition.zone]
        ? computeStateName(states[condition.zone])
        : condition.zone;
    }

    return `Confirm ${entities} ${entitiesPlural ? "are" : "is"} in ${zones} ${
      zonesPlural ? "zones" : "zone"
    }`;
  }

  if (condition.condition === "device") {
    if (!condition.device_id) {
      return "Device condition";
    }
    const config = condition as DeviceCondition;
    const localized = localizeDeviceAutomationCondition(
      hass,
      entityRegistry,
      config
    );
    if (localized) {
      return localized;
    }
    const stateObj = hass.states[config.entity_id as string];
    return `${stateObj ? computeStateName(stateObj) : config.entity_id} ${
      config.type
    }`;
  }

  if (condition.condition === "trigger") {
    if (!condition.id) {
      return "Trigger condition";
    }
    return `When triggered by ${condition.id}`;
  }

  return `${
    condition.condition ? condition.condition.replace(/_/g, " ") : "Unknown"
  } condition`;
};

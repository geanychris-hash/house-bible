/* GENERATED from schema.json by apps-script/build.mjs. Do not edit by hand. */
var HB_SCHEMA = {
  "schemaVersion": 1,
  "system": [
    "id",
    "rev",
    "updatedAt",
    "updatedBy",
    "deleted"
  ],
  "tables": {
    "rooms": {
      "fields": [
        {
          "name": "name",
          "type": "text"
        },
        {
          "name": "floor",
          "type": "text"
        },
        {
          "name": "length_in",
          "type": "num"
        },
        {
          "name": "width_in",
          "type": "num"
        },
        {
          "name": "height_in",
          "type": "num"
        },
        {
          "name": "flooring",
          "type": "text"
        },
        {
          "name": "wall_color",
          "type": "text"
        },
        {
          "name": "paint_notes",
          "type": "text"
        },
        {
          "name": "outlets",
          "type": "text"
        },
        {
          "name": "windows",
          "type": "text"
        },
        {
          "name": "notes",
          "type": "text"
        },
        {
          "name": "photos",
          "type": "files"
        }
      ]
    },
    "assets": {
      "fields": [
        {
          "name": "name",
          "type": "text"
        },
        {
          "name": "kind",
          "type": "text",
          "enum": [
            "system",
            "appliance",
            "fixture",
            "other",
            "belonging"
          ]
        },
        {
          "name": "room",
          "type": "ref",
          "ref": "rooms"
        },
        {
          "name": "brand",
          "type": "text"
        },
        {
          "name": "model",
          "type": "text"
        },
        {
          "name": "serial",
          "type": "text"
        },
        {
          "name": "install_date",
          "type": "text"
        },
        {
          "name": "location",
          "type": "text"
        },
        {
          "name": "fuel",
          "type": "text"
        },
        {
          "name": "notes",
          "type": "text"
        },
        {
          "name": "warranty_expires",
          "type": "date"
        },
        {
          "name": "pro_only",
          "type": "bool"
        },
        {
          "name": "photos",
          "type": "files"
        },
        {
          "name": "docs",
          "type": "json"
        },
        {
          "name": "expected_life_years",
          "type": "num"
        },
        {
          "name": "replace_cost",
          "type": "num"
        },
        {
          "name": "purchase_price",
          "type": "num"
        },
        {
          "name": "purchase_date",
          "type": "date"
        },
        {
          "name": "replacement_value",
          "type": "num"
        }
      ]
    },
    "shutoffs": {
      "fields": [
        {
          "name": "name",
          "type": "text"
        },
        {
          "name": "type",
          "type": "text",
          "enum": [
            "water",
            "gas",
            "electric",
            "other"
          ]
        },
        {
          "name": "room",
          "type": "ref",
          "ref": "rooms"
        },
        {
          "name": "location",
          "type": "text"
        },
        {
          "name": "how_to",
          "type": "text"
        },
        {
          "name": "photos",
          "type": "files"
        }
      ]
    },
    "tasks": {
      "fields": [
        {
          "name": "title",
          "type": "text"
        },
        {
          "name": "category",
          "type": "text",
          "enum": [
            "house",
            "steam",
            "yard",
            "safety",
            "pet",
            "vehicle",
            "health",
            "other"
          ]
        },
        {
          "name": "subject",
          "type": "text"
        },
        {
          "name": "rule",
          "type": "json"
        },
        {
          "name": "start",
          "type": "date"
        },
        {
          "name": "time",
          "type": "text"
        },
        {
          "name": "why",
          "type": "text"
        },
        {
          "name": "how",
          "type": "text"
        },
        {
          "name": "safety",
          "type": "text"
        },
        {
          "name": "pro_only",
          "type": "bool"
        },
        {
          "name": "asset",
          "type": "ref",
          "ref": "assets"
        },
        {
          "name": "room",
          "type": "ref",
          "ref": "rooms"
        },
        {
          "name": "assignee",
          "type": "text"
        },
        {
          "name": "calendar",
          "type": "bool"
        },
        {
          "name": "active",
          "type": "bool"
        },
        {
          "name": "source",
          "type": "text",
          "enum": [
            "seed",
            "user"
          ]
        },
        {
          "name": "seed_key",
          "type": "text"
        }
      ]
    },
    "task_log": {
      "fields": [
        {
          "name": "task",
          "type": "ref",
          "ref": "tasks"
        },
        {
          "name": "date",
          "type": "date"
        },
        {
          "name": "by",
          "type": "text"
        },
        {
          "name": "note",
          "type": "text"
        },
        {
          "name": "cost",
          "type": "num"
        },
        {
          "name": "photos",
          "type": "files"
        },
        {
          "name": "contact",
          "type": "ref",
          "ref": "contacts"
        }
      ]
    },
    "consumables": {
      "fields": [
        {
          "name": "name",
          "type": "text"
        },
        {
          "name": "asset",
          "type": "ref",
          "ref": "assets"
        },
        {
          "name": "room",
          "type": "ref",
          "ref": "rooms"
        },
        {
          "name": "spec",
          "type": "text"
        },
        {
          "name": "qty_on_hand",
          "type": "num"
        },
        {
          "name": "interval_days",
          "type": "num"
        },
        {
          "name": "last_replaced",
          "type": "date"
        },
        {
          "name": "notes",
          "type": "text"
        }
      ]
    },
    "documents": {
      "fields": [
        {
          "name": "title",
          "type": "text"
        },
        {
          "name": "kind",
          "type": "text",
          "enum": [
            "manual",
            "receipt",
            "permit",
            "inspection",
            "closing",
            "warranty",
            "insurance",
            "photo",
            "other"
          ]
        },
        {
          "name": "file",
          "type": "text"
        },
        {
          "name": "room",
          "type": "ref",
          "ref": "rooms"
        },
        {
          "name": "asset",
          "type": "ref",
          "ref": "assets"
        },
        {
          "name": "project",
          "type": "ref",
          "ref": "projects"
        },
        {
          "name": "tags",
          "type": "text"
        },
        {
          "name": "expires",
          "type": "date"
        },
        {
          "name": "notes",
          "type": "text"
        }
      ]
    },
    "contacts": {
      "fields": [
        {
          "name": "name",
          "type": "text"
        },
        {
          "name": "trade",
          "type": "text"
        },
        {
          "name": "company",
          "type": "text"
        },
        {
          "name": "phone",
          "type": "text"
        },
        {
          "name": "email",
          "type": "text"
        },
        {
          "name": "last_job",
          "type": "text"
        },
        {
          "name": "last_job_date",
          "type": "date"
        },
        {
          "name": "cost",
          "type": "num"
        },
        {
          "name": "would_rehire",
          "type": "bool"
        },
        {
          "name": "notes",
          "type": "text"
        }
      ]
    },
    "steam_log": {
      "fields": [
        {
          "name": "date",
          "type": "date"
        },
        {
          "name": "time",
          "type": "text"
        },
        {
          "name": "water_level",
          "type": "text"
        },
        {
          "name": "pressure_psi",
          "type": "num"
        },
        {
          "name": "event",
          "type": "text",
          "enum": [
            "check",
            "vent",
            "blowdown",
            "service",
            "problem"
          ]
        },
        {
          "name": "notes",
          "type": "text"
        },
        {
          "name": "photos",
          "type": "files"
        }
      ]
    },
    "projects": {
      "fields": [
        {
          "name": "name",
          "type": "text"
        },
        {
          "name": "status",
          "type": "text",
          "enum": [
            "idea",
            "planned",
            "active",
            "done",
            "dropped"
          ]
        },
        {
          "name": "priority",
          "type": "text",
          "enum": [
            "Safety",
            "Damage",
            "Comfort",
            "Cosmetic"
          ]
        },
        {
          "name": "pro",
          "type": "bool"
        },
        {
          "name": "season",
          "type": "text"
        },
        {
          "name": "budget",
          "type": "num"
        },
        {
          "name": "deps",
          "type": "json"
        },
        {
          "name": "room",
          "type": "ref",
          "ref": "rooms"
        },
        {
          "name": "notes",
          "type": "text"
        },
        {
          "name": "steps",
          "type": "json"
        },
        {
          "name": "parts",
          "type": "json"
        },
        {
          "name": "capital_improvement",
          "type": "bool"
        }
      ]
    },
    "materials": {
      "fields": [
        {
          "name": "project",
          "type": "ref",
          "ref": "projects"
        },
        {
          "name": "item",
          "type": "text"
        },
        {
          "name": "qty",
          "type": "num"
        },
        {
          "name": "unit",
          "type": "text"
        },
        {
          "name": "price_hd",
          "type": "num"
        },
        {
          "name": "price_hf",
          "type": "num"
        },
        {
          "name": "price_other",
          "type": "num"
        },
        {
          "name": "have",
          "type": "bool"
        }
      ]
    },
    "expenses": {
      "fields": [
        {
          "name": "date",
          "type": "date"
        },
        {
          "name": "item",
          "type": "text"
        },
        {
          "name": "store",
          "type": "text"
        },
        {
          "name": "amount",
          "type": "num"
        },
        {
          "name": "category",
          "type": "text"
        },
        {
          "name": "project",
          "type": "ref",
          "ref": "projects"
        },
        {
          "name": "room",
          "type": "ref",
          "ref": "rooms"
        },
        {
          "name": "receipt",
          "type": "ref",
          "ref": "documents"
        },
        {
          "name": "capital_improvement",
          "type": "bool"
        },
        {
          "name": "notes",
          "type": "text"
        },
        {
          "name": "contact",
          "type": "ref",
          "ref": "contacts"
        }
      ]
    },
    "tools": {
      "fields": [
        {
          "name": "name",
          "type": "text"
        },
        {
          "name": "category",
          "type": "text"
        },
        {
          "name": "status",
          "type": "text",
          "enum": [
            "own",
            "want"
          ]
        },
        {
          "name": "brand",
          "type": "text"
        },
        {
          "name": "model",
          "type": "text"
        },
        {
          "name": "notes",
          "type": "text"
        },
        {
          "name": "location",
          "type": "text"
        },
        {
          "name": "lent_to",
          "type": "text"
        }
      ]
    },
    "utilities": {
      "fields": [
        {
          "name": "date",
          "type": "date"
        },
        {
          "name": "kind",
          "type": "text",
          "enum": [
            "gas",
            "oil",
            "electric",
            "water",
            "other"
          ]
        },
        {
          "name": "amount",
          "type": "num"
        },
        {
          "name": "usage",
          "type": "num"
        },
        {
          "name": "unit",
          "type": "text"
        },
        {
          "name": "notes",
          "type": "text"
        },
        {
          "name": "hdd",
          "type": "num"
        }
      ]
    },
    "sensitive": {
      "fields": [
        {
          "name": "label",
          "type": "text"
        },
        {
          "name": "ciphertext",
          "type": "text"
        },
        {
          "name": "iv",
          "type": "text"
        },
        {
          "name": "hint",
          "type": "text"
        }
      ]
    },
    "settings": {
      "fields": [
        {
          "name": "key",
          "type": "text"
        },
        {
          "name": "value",
          "type": "json"
        }
      ]
    }
  }
};

/* eslint-disable */
// This file is generated from openapi.json. Do not edit it by hand.

export const REQUEST_CASING_SCHEMAS = {
  Activity: {
    kind: "object",
    properties: {
      analysisIssues: {
        wire: "analysis_issues",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "ActivityAnalysisIssue",
          },
        },
      },
      analyzed: {
        wire: "analyzed",
      },
      athleteMaxHr: {
        wire: "athlete_max_hr",
      },
      attachments: {
        wire: "attachments",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Attachment",
          },
        },
      },
      averageAltitude: {
        wire: "average_altitude",
      },
      averageCadence: {
        wire: "average_cadence",
      },
      averageClouds: {
        wire: "average_clouds",
      },
      averageFeelsLike: {
        wire: "average_feels_like",
      },
      averageHeartrate: {
        wire: "average_heartrate",
      },
      averageImpactLoadingRate: {
        wire: "average_impact_loading_rate",
      },
      averageLegSpringStiffness: {
        wire: "average_leg_spring_stiffness",
      },
      averageSpeed: {
        wire: "average_speed",
      },
      averageStanceTime: {
        wire: "average_stance_time",
      },
      averageStanceTimeBalance: {
        wire: "average_stance_time_balance",
      },
      averageStanceTimePercent: {
        wire: "average_stance_time_percent",
      },
      averageStepLength: {
        wire: "average_step_length",
      },
      averageStride: {
        wire: "average_stride",
      },
      averageTemp: {
        wire: "average_temp",
      },
      averageVerticalOscillation: {
        wire: "average_vertical_oscillation",
      },
      averageVerticalRatio: {
        wire: "average_vertical_ratio",
      },
      averageVerticalSpeed: {
        wire: "average_vertical_speed",
      },
      averageWeatherTemp: {
        wire: "average_weather_temp",
      },
      averageWindGust: {
        wire: "average_wind_gust",
      },
      averageWindSpeed: {
        wire: "average_wind_speed",
      },
      avgLrBalance: {
        wire: "avg_lr_balance",
      },
      calories: {
        wire: "calories",
      },
      carbsIngested: {
        wire: "carbs_ingested",
      },
      carbsUsed: {
        wire: "carbs_used",
      },
      coachTick: {
        wire: "coach_tick",
      },
      coastingTime: {
        wire: "coasting_time",
      },
      commute: {
        wire: "commute",
      },
      compliance: {
        wire: "compliance",
      },
      crankLength: {
        wire: "crank_length",
      },
      created: {
        wire: "created",
      },
      customZones: {
        wire: "custom_zones",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "ZoneSet",
          },
        },
      },
      decoupling: {
        wire: "decoupling",
      },
      description: {
        wire: "description",
      },
      deviceName: {
        wire: "device_name",
      },
      deviceWatts: {
        wire: "device_watts",
      },
      distance: {
        wire: "distance",
      },
      elapsedTime: {
        wire: "elapsed_time",
      },
      externalId: {
        wire: "external_id",
      },
      feel: {
        wire: "feel",
      },
      fileSportIndex: {
        wire: "file_sport_index",
      },
      fileType: {
        wire: "file_type",
      },
      gap: {
        wire: "gap",
      },
      gapModel: {
        wire: "gap_model",
      },
      gapZoneTimes: {
        wire: "gap_zone_times",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      gear: {
        wire: "gear",
        value: {
          kind: "ref",
          name: "StravaGear",
        },
      },
      group: {
        wire: "group",
      },
      hasHeartrate: {
        wire: "has_heartrate",
      },
      hasSegments: {
        wire: "has_segments",
      },
      hasWeather: {
        wire: "has_weather",
      },
      headwindPercent: {
        wire: "headwind_percent",
      },
      hrLoad: {
        wire: "hr_load",
      },
      hrLoadType: {
        wire: "hr_load_type",
      },
      icuAchievements: {
        wire: "icu_achievements",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "IcuAchievement",
          },
        },
      },
      icuAthleteId: {
        wire: "icu_athlete_id",
      },
      icuAtl: {
        wire: "icu_atl",
      },
      icuAverageWatts: {
        wire: "icu_average_watts",
      },
      icuCadenceZ2: {
        wire: "icu_cadence_z2",
      },
      icuChatId: {
        wire: "icu_chat_id",
      },
      icuColor: {
        wire: "icu_color",
      },
      icuCooldownTime: {
        wire: "icu_cooldown_time",
      },
      icuCtl: {
        wire: "icu_ctl",
      },
      icuDistance: {
        wire: "icu_distance",
      },
      icuEfficiencyFactor: {
        wire: "icu_efficiency_factor",
      },
      icuFtp: {
        wire: "icu_ftp",
      },
      icuHrZoneTimes: {
        wire: "icu_hr_zone_times",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      icuHrZones: {
        wire: "icu_hr_zones",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      icuHrr: {
        wire: "icu_hrr",
        value: {
          kind: "ref",
          name: "HRRecovery",
        },
      },
      icuIgnoreHr: {
        wire: "icu_ignore_hr",
      },
      icuIgnorePower: {
        wire: "icu_ignore_power",
      },
      icuIgnoreTime: {
        wire: "icu_ignore_time",
      },
      icuIntensity: {
        wire: "icu_intensity",
      },
      icuIntervalsEdited: {
        wire: "icu_intervals_edited",
      },
      icuJoules: {
        wire: "icu_joules",
      },
      icuJoulesAboveFtp: {
        wire: "icu_joules_above_ftp",
      },
      icuLapCount: {
        wire: "icu_lap_count",
      },
      icuMaxWbalDepletion: {
        wire: "icu_max_wbal_depletion",
      },
      icuMedianTimeDelta: {
        wire: "icu_median_time_delta",
      },
      icuPmCp: {
        wire: "icu_pm_cp",
      },
      icuPmFtp: {
        wire: "icu_pm_ftp",
      },
      icuPmFtpSecs: {
        wire: "icu_pm_ftp_secs",
      },
      icuPmFtpWatts: {
        wire: "icu_pm_ftp_watts",
      },
      icuPmPMax: {
        wire: "icu_pm_p_max",
      },
      icuPmWPrime: {
        wire: "icu_pm_w_prime",
      },
      icuPowerHr: {
        wire: "icu_power_hr",
      },
      icuPowerHrZ2: {
        wire: "icu_power_hr_z2",
      },
      icuPowerHrZ2Mins: {
        wire: "icu_power_hr_z2_mins",
      },
      icuPowerSpikeThreshold: {
        wire: "icu_power_spike_threshold",
      },
      icuPowerZones: {
        wire: "icu_power_zones",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      icuRecordingTime: {
        wire: "icu_recording_time",
      },
      icuRestingHr: {
        wire: "icu_resting_hr",
      },
      icuRollingCp: {
        wire: "icu_rolling_cp",
      },
      icuRollingFtp: {
        wire: "icu_rolling_ftp",
      },
      icuRollingFtpDelta: {
        wire: "icu_rolling_ftp_delta",
      },
      icuRollingPMax: {
        wire: "icu_rolling_p_max",
      },
      icuRollingWPrime: {
        wire: "icu_rolling_w_prime",
      },
      icuRpe: {
        wire: "icu_rpe",
      },
      icuSweetSpotMax: {
        wire: "icu_sweet_spot_max",
      },
      icuSweetSpotMin: {
        wire: "icu_sweet_spot_min",
      },
      icuSyncDate: {
        wire: "icu_sync_date",
      },
      icuSyncError: {
        wire: "icu_sync_error",
      },
      icuTrainingLoad: {
        wire: "icu_training_load",
      },
      icuTrainingLoadData: {
        wire: "icu_training_load_data",
      },
      icuVariabilityIndex: {
        wire: "icu_variability_index",
      },
      icuWPrime: {
        wire: "icu_w_prime",
      },
      icuWarmupTime: {
        wire: "icu_warmup_time",
      },
      icuWeight: {
        wire: "icu_weight",
      },
      icuWeightedAvgWatts: {
        wire: "icu_weighted_avg_watts",
      },
      icuZoneTimes: {
        wire: "icu_zone_times",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "ZoneTime",
          },
        },
      },
      id: {
        wire: "id",
      },
      ignorePace: {
        wire: "ignore_pace",
      },
      ignoreParts: {
        wire: "ignore_parts",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Ignore",
          },
        },
      },
      ignoreVelocity: {
        wire: "ignore_velocity",
      },
      intervalSummary: {
        wire: "interval_summary",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      kgLifted: {
        wire: "kg_lifted",
      },
      lengths: {
        wire: "lengths",
      },
      lockIntervals: {
        wire: "lock_intervals",
      },
      lthr: {
        wire: "lthr",
      },
      maxAltitude: {
        wire: "max_altitude",
      },
      maxFeelsLike: {
        wire: "max_feels_like",
      },
      maxHeartrate: {
        wire: "max_heartrate",
      },
      maxRain: {
        wire: "max_rain",
      },
      maxSnow: {
        wire: "max_snow",
      },
      maxSpeed: {
        wire: "max_speed",
      },
      maxTemp: {
        wire: "max_temp",
      },
      maxWeatherTemp: {
        wire: "max_weather_temp",
      },
      minAltitude: {
        wire: "min_altitude",
      },
      minFeelsLike: {
        wire: "min_feels_like",
      },
      minTemp: {
        wire: "min_temp",
      },
      minWeatherTemp: {
        wire: "min_weather_temp",
      },
      movingTime: {
        wire: "moving_time",
      },
      name: {
        wire: "name",
      },
      oauthClientId: {
        wire: "oauth_client_id",
      },
      oauthClientName: {
        wire: "oauth_client_name",
      },
      p30sExponent: {
        wire: "p30s_exponent",
      },
      pMax: {
        wire: "p_max",
      },
      pace: {
        wire: "pace",
      },
      paceLoad: {
        wire: "pace_load",
      },
      paceLoadType: {
        wire: "pace_load_type",
      },
      paceZoneTimes: {
        wire: "pace_zone_times",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      paceZones: {
        wire: "pace_zones",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      pairedEventId: {
        wire: "paired_event_id",
      },
      perceivedExertion: {
        wire: "perceived_exertion",
      },
      polarizationIndex: {
        wire: "polarization_index",
      },
      poolLength: {
        wire: "pool_length",
      },
      powerField: {
        wire: "power_field",
      },
      powerFieldNames: {
        wire: "power_field_names",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      powerLoad: {
        wire: "power_load",
      },
      powerMeter: {
        wire: "power_meter",
      },
      powerMeterBattery: {
        wire: "power_meter_battery",
      },
      powerMeterSerial: {
        wire: "power_meter_serial",
      },
      prevailingWindDeg: {
        wire: "prevailing_wind_deg",
      },
      race: {
        wire: "race",
      },
      recordingStops: {
        wire: "recording_stops",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      routeId: {
        wire: "route_id",
      },
      sessionRpe: {
        wire: "session_rpe",
      },
      skylineChartBytes: {
        wire: "skyline_chart_bytes",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      source: {
        wire: "source",
      },
      ssCp: {
        wire: "ss_cp",
      },
      ssPMax: {
        wire: "ss_p_max",
      },
      ssWPrime: {
        wire: "ss_w_prime",
      },
      startDate: {
        wire: "start_date",
      },
      startDateLocal: {
        wire: "start_date_local",
      },
      strainScore: {
        wire: "strain_score",
      },
      stravaId: {
        wire: "strava_id",
      },
      streamTypes: {
        wire: "stream_types",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      subType: {
        wire: "sub_type",
      },
      tags: {
        wire: "tags",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      tailwindPercent: {
        wire: "tailwind_percent",
      },
      thresholdPace: {
        wire: "threshold_pace",
      },
      timezone: {
        wire: "timezone",
      },
      tizOrder: {
        wire: "tiz_order",
      },
      totalElevationGain: {
        wire: "total_elevation_gain",
      },
      totalElevationLoss: {
        wire: "total_elevation_loss",
      },
      trainer: {
        wire: "trainer",
      },
      trimp: {
        wire: "trimp",
      },
      type: {
        wire: "type",
      },
      useElevationCorrection: {
        wire: "use_elevation_correction",
      },
      useGapZoneTimes: {
        wire: "use_gap_zone_times",
      },
      workoutShiftSecs: {
        wire: "workout_shift_secs",
      },
    },
  },
  ActivityAnalysisIssue: {
    kind: "object",
    properties: {
      customItemId: {
        wire: "custom_item_id",
      },
      message: {
        wire: "message",
      },
      type: {
        wire: "type",
      },
    },
  },
  ActivityCharts: {
    kind: "object",
    properties: {
      data: {
        wire: "data",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Pos",
          },
        },
      },
      home: {
        wire: "home",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Pos",
          },
        },
      },
      hr: {
        wire: "hr",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Pos",
          },
        },
      },
      pace: {
        wire: "pace",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Pos",
          },
        },
      },
      power: {
        wire: "power",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Pos",
          },
        },
      },
    },
  },
  ActivityFilter: {
    kind: "object",
    properties: {
      code: {
        wire: "code",
      },
      fieldId: {
        wire: "field_id",
      },
      id: {
        wire: "id",
      },
      not: {
        wire: "not",
      },
      operator: {
        wire: "operator",
      },
      value: {
        wire: "value",
        value: {
          kind: "opaque",
        },
      },
    },
  },
  ActivityStream: {
    kind: "object",
    properties: {
      allNull: {
        wire: "allNull",
      },
      anomalies: {
        wire: "anomalies",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Anomaly",
          },
        },
      },
      custom: {
        wire: "custom",
      },
      data: {
        wire: "data",
        value: {
          kind: "opaque",
        },
      },
      data2: {
        wire: "data2",
        value: {
          kind: "opaque",
        },
      },
      name: {
        wire: "name",
      },
      type: {
        wire: "type",
      },
      valueTypeIsArray: {
        wire: "valueTypeIsArray",
      },
    },
  },
  Anomaly: {
    kind: "object",
    properties: {
      endIndex: {
        wire: "end_index",
      },
      startIndex: {
        wire: "start_index",
      },
      value: {
        wire: "value",
      },
      valueEnd: {
        wire: "valueEnd",
      },
    },
  },
  ApplyPlanDTO: {
    kind: "object",
    properties: {
      extraWorkouts: {
        wire: "extra_workouts",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Workout",
          },
        },
      },
      folderId: {
        wire: "folder_id",
      },
      startDateLocal: {
        wire: "start_date_local",
      },
    },
  },
  AthleteRoute: {
    kind: "object",
    properties: {
      athleteId: {
        wire: "athlete_id",
      },
      commute: {
        wire: "commute",
      },
      description: {
        wire: "description",
      },
      latlngs: {
        wire: "latlngs",
        value: {
          kind: "array",
          item: {
            kind: "array",
            item: {
              kind: "opaque",
            },
          },
        },
      },
      name: {
        wire: "name",
      },
      renameActivities: {
        wire: "rename_activities",
      },
      replacedByRouteId: {
        wire: "replaced_by_route_id",
      },
      routeId: {
        wire: "route_id",
      },
      tags: {
        wire: "tags",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
    },
  },
  AthleteSearchResult: {
    kind: "object",
    properties: {
      bio: {
        wire: "bio",
      },
      city: {
        wire: "city",
      },
      country: {
        wire: "country",
      },
      email: {
        wire: "email",
      },
      id: {
        wire: "id",
      },
      name: {
        wire: "name",
      },
      profileMedium: {
        wire: "profile_medium",
      },
      sex: {
        wire: "sex",
      },
      state: {
        wire: "state",
      },
      timezone: {
        wire: "timezone",
      },
      website: {
        wire: "website",
      },
    },
  },
  AthleteTrainingAvailability: {
    kind: "object",
    properties: {
      canTrainSports: {
        wire: "can_train_sports",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      dayOfWeek: {
        wire: "day_of_week",
      },
      maxTrainingTime: {
        wire: "max_training_time",
      },
      trainingAvailability: {
        wire: "training_availability",
      },
    },
  },
  AthleteTrainingPlanUpdate: {
    kind: "object",
    properties: {
      id: {
        wire: "id",
      },
      trainingPlanAlias: {
        wire: "training_plan_alias",
      },
      trainingPlanId: {
        wire: "training_plan_id",
      },
      trainingPlanStartDate: {
        wire: "training_plan_start_date",
      },
    },
  },
  AthleteUpdateDTO: {
    kind: "object",
    properties: {
      activityRpePrompt: {
        wire: "activity_rpe_prompt",
      },
      addWeatherToStravaDescr: {
        wire: "add_weather_to_strava_descr",
      },
      applyToAll: {
        wire: "applyToAll",
      },
      betaUser: {
        wire: "beta_user",
      },
      bikes: {
        wire: "bikes",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "StravaGear",
          },
        },
      },
      bio: {
        wire: "bio",
      },
      city: {
        wire: "city",
      },
      coachTicks: {
        wire: "coach_ticks",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "CoachTick",
          },
        },
      },
      concept2SyncActivities: {
        wire: "concept2_sync_activities",
      },
      concept2UserId: {
        wire: "concept2_user_id",
      },
      corosDownloadWellness: {
        wire: "coros_download_wellness",
      },
      corosLastUpload: {
        wire: "coros_last_upload",
      },
      corosSyncActivities: {
        wire: "coros_sync_activities",
      },
      corosUploadWorkouts: {
        wire: "coros_upload_workouts",
      },
      corosUserId: {
        wire: "coros_user_id",
      },
      countries: {
        wire: "countries",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      country: {
        wire: "country",
      },
      currency: {
        wire: "currency",
      },
      dateFormat: {
        wire: "date_format",
      },
      dropboxScope: {
        wire: "dropbox_scope",
      },
      email: {
        wire: "email",
      },
      emailNotifications: {
        wire: "email_notifications",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      fahrenheit: {
        wire: "fahrenheit",
      },
      firstname: {
        wire: "firstname",
      },
      garminPaceRange: {
        wire: "garmin_pace_range",
      },
      garminPowerTarget: {
        wire: "garmin_power_target",
      },
      garminSyncActivityTypes: {
        wire: "garmin_sync_activity_types",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      garminSyncAfter: {
        wire: "garmin_sync_after",
      },
      googleScope: {
        wire: "google_scope",
      },
      googleWellnessKeys: {
        wire: "google_wellness_keys",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      hasPassword: {
        wire: "has_password",
      },
      hasPushSubscriptions: {
        wire: "has_push_subscriptions",
      },
      height: {
        wire: "height",
      },
      heightUnits: {
        wire: "height_units",
      },
      huaweiDownloadWellness: {
        wire: "huawei_download_wellness",
      },
      huaweiSyncActivities: {
        wire: "huawei_sync_activities",
      },
      huaweiUploadWorkouts: {
        wire: "huawei_upload_workouts",
      },
      huaweiUserId: {
        wire: "huawei_user_id",
      },
      icuActivated: {
        wire: "icu_activated",
      },
      icuAdmin: {
        wire: "icu_admin",
      },
      icuApiKey: {
        wire: "icu_api_key",
      },
      icuCoach: {
        wire: "icu_coach",
      },
      icuDateOfBirth: {
        wire: "icu_date_of_birth",
      },
      icuEffortSecs: {
        wire: "icu_effort_secs",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      icuEmailDisabled: {
        wire: "icu_email_disabled",
      },
      icuEmailVerified: {
        wire: "icu_email_verified",
      },
      icuFormAsPercent: {
        wire: "icu_form_as_percent",
      },
      icuFriendInviteToken: {
        wire: "icu_friend_invite_token",
      },
      icuGarminDownloadWellness: {
        wire: "icu_garmin_download_wellness",
      },
      icuGarminHealth: {
        wire: "icu_garmin_health",
      },
      icuGarminHrRange: {
        wire: "icu_garmin_hr_range",
      },
      icuGarminLastUpload: {
        wire: "icu_garmin_last_upload",
      },
      icuGarminOutdoorPowerRange: {
        wire: "icu_garmin_outdoor_power_range",
      },
      icuGarminSyncActivities: {
        wire: "icu_garmin_sync_activities",
      },
      icuGarminTraining: {
        wire: "icu_garmin_training",
      },
      icuGarminUploadFilters: {
        wire: "icu_garmin_upload_filters",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "ActivityFilter",
          },
        },
      },
      icuGarminUploadWorkouts: {
        wire: "icu_garmin_upload_workouts",
      },
      icuGarminWellnessKeys: {
        wire: "icu_garmin_wellness_keys",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      icuLastSeen: {
        wire: "icu_last_seen",
      },
      icuMenstrualCyclePerm: {
        wire: "icu_menstrual_cycle_perm",
      },
      icuMmpDays: {
        wire: "icu_mmp_days",
      },
      icuNotes: {
        wire: "icu_notes",
      },
      icuPermission: {
        wire: "icu_permission",
      },
      icuQueuePos: {
        wire: "icu_queue_pos",
      },
      icuRestingHr: {
        wire: "icu_resting_hr",
      },
      icuSendAchievements: {
        wire: "icu_send_achievements",
      },
      icuSendActivityChat: {
        wire: "icu_send_activity_chat",
      },
      icuSendActivityMsg: {
        wire: "icu_send_activity_msg",
      },
      icuSendCoachMeReq: {
        wire: "icu_send_coach_me_req",
      },
      icuSendCoachTick: {
        wire: "icu_send_coach_tick",
      },
      icuSendCoachedActivityChat: {
        wire: "icu_send_coached_activity_chat",
      },
      icuSendCoachedNewActivity: {
        wire: "icu_send_coached_new_activity",
      },
      icuSendFollowReq: {
        wire: "icu_send_follow_req",
      },
      icuSendFollowedActivityChat: {
        wire: "icu_send_followed_activity_chat",
      },
      icuSendFollowedNewActivity: {
        wire: "icu_send_followed_new_activity",
      },
      icuSendGearAlerts: {
        wire: "icu_send_gear_alerts",
      },
      icuSendGroupChat: {
        wire: "icu_send_group_chat",
      },
      icuSendGroupMsg: {
        wire: "icu_send_group_msg",
      },
      icuSendNewsletter: {
        wire: "icu_send_newsletter",
      },
      icuSendPlanForWeek: {
        wire: "icu_send_plan_for_week",
      },
      icuSendPrivateChat: {
        wire: "icu_send_private_chat",
      },
      icuSendPrivateMsg: {
        wire: "icu_send_private_msg",
      },
      icuTags: {
        wire: "icu_tags",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      icuTrackMenstrualCycle: {
        wire: "icu_track_menstrual_cycle",
      },
      icuTypeSettings: {
        wire: "icu_type_settings",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Settings",
          },
        },
      },
      icuWeight: {
        wire: "icu_weight",
      },
      icuWeightSync: {
        wire: "icu_weight_sync",
      },
      icuWellnessKeys: {
        wire: "icu_wellness_keys",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      icuWellnessPrompt: {
        wire: "icu_wellness_prompt",
      },
      id: {
        wire: "id",
      },
      ignoreStravaGear: {
        wire: "ignore_strava_gear",
      },
      includeDescrInPlanForWeek: {
        wire: "include_descr_in_plan_for_week",
      },
      languages: {
        wire: "languages",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      lastname: {
        wire: "lastname",
      },
      localDate: {
        wire: "localDate",
      },
      locale: {
        wire: "locale",
      },
      measurementPreference: {
        wire: "measurement_preference",
      },
      name: {
        wire: "name",
      },
      notificationAthleteTagsEnabled: {
        wire: "notification_athlete_tags_enabled",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      openStepDuration: {
        wire: "open_step_duration",
      },
      ouraScope: {
        wire: "oura_scope",
      },
      ouraWellnessKeys: {
        wire: "oura_wellness_keys",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      password: {
        wire: "password",
      },
      plan: {
        wire: "plan",
      },
      planExpires: {
        wire: "plan_expires",
      },
      polarDownloadWellness: {
        wire: "polar_download_wellness",
      },
      polarScope: {
        wire: "polar_scope",
      },
      polarSyncActivities: {
        wire: "polar_sync_activities",
      },
      polarSyncActivityTypes: {
        wire: "polar_sync_activity_types",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      polarWellnessKeys: {
        wire: "polar_wellness_keys",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      privateWellnessKeys: {
        wire: "private_wellness_keys",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      profileMedium: {
        wire: "profile_medium",
      },
      pushNotifications: {
        wire: "push_notifications",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      rain: {
        wire: "rain",
      },
      recalcHrZones: {
        wire: "recalcHrZones",
      },
      scope: {
        wire: "scope",
      },
      sex: {
        wire: "sex",
      },
      shoes: {
        wire: "shoes",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "StravaGear",
          },
        },
      },
      sponsoredByChatId: {
        wire: "sponsored_by_chat_id",
      },
      state: {
        wire: "state",
      },
      status: {
        wire: "status",
      },
      statusUpdated: {
        wire: "status_updated",
      },
      stravaAllowed: {
        wire: "strava_allowed",
      },
      stravaAuthorized: {
        wire: "strava_authorized",
      },
      stravaId: {
        wire: "strava_id",
      },
      stravaSyncActivities: {
        wire: "strava_sync_activities",
      },
      stravaSyncActivityTypes: {
        wire: "strava_sync_activity_types",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      stravaSyncOtherActivities: {
        wire: "strava_sync_other_activities",
      },
      suuntoDownloadWellness: {
        wire: "suunto_download_wellness",
      },
      suuntoHrRange: {
        wire: "suunto_hr_range",
      },
      suuntoLastUpload: {
        wire: "suunto_last_upload",
      },
      suuntoOutdoorPowerRange: {
        wire: "suunto_outdoor_power_range",
      },
      suuntoPaceRange: {
        wire: "suunto_pace_range",
      },
      suuntoScope: {
        wire: "suunto_scope",
      },
      suuntoSyncActivities: {
        wire: "suunto_sync_activities",
      },
      suuntoSyncActivityTypes: {
        wire: "suunto_sync_activity_types",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      suuntoUploadFilters: {
        wire: "suunto_upload_filters",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "ActivityFilter",
          },
        },
      },
      suuntoUploadWorkouts: {
        wire: "suunto_upload_workouts",
      },
      suuntoUserId: {
        wire: "suunto_user_id",
      },
      timeFormat: {
        wire: "time_format",
      },
      timezone: {
        wire: "timezone",
      },
      trainingAvailability: {
        wire: "training_availability",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "AthleteTrainingAvailability",
          },
        },
      },
      trainingPlanId: {
        wire: "training_plan_id",
      },
      trainingPlanStartDate: {
        wire: "training_plan_start_date",
      },
      trialEndDate: {
        wire: "trial_end_date",
      },
      updateStravaName: {
        wire: "update_strava_name",
      },
      visibility: {
        wire: "visibility",
      },
      wahooSyncActivities: {
        wire: "wahoo_sync_activities",
      },
      wahooUploadWorkouts: {
        wire: "wahoo_upload_workouts",
      },
      wahooUserId: {
        wire: "wahoo_user_id",
      },
      website: {
        wire: "website",
      },
      weight: {
        wire: "weight",
      },
      weightPrefLb: {
        wire: "weight_pref_lb",
      },
      wellnessLastPromptDate: {
        wire: "wellness_last_prompt_date",
      },
      whoopScope: {
        wire: "whoop_scope",
      },
      whoopWellnessKeys: {
        wire: "whoop_wellness_keys",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      windSpeed: {
        wire: "wind_speed",
      },
      zeppDownloadWellness: {
        wire: "zepp_download_wellness",
      },
      zeppSyncActivities: {
        wire: "zepp_sync_activities",
      },
      zeppUploadWorkouts: {
        wire: "zepp_upload_workouts",
      },
      zeppUserId: {
        wire: "zepp_user_id",
      },
      zwiftSyncActivities: {
        wire: "zwift_sync_activities",
      },
      zwiftUploadWorkouts: {
        wire: "zwift_upload_workouts",
      },
      zwiftUserId: {
        wire: "zwift_user_id",
      },
    },
  },
  Attachment: {
    kind: "object",
    properties: {
      filename: {
        wire: "filename",
      },
      id: {
        wire: "id",
      },
      mimetype: {
        wire: "mimetype",
      },
      url: {
        wire: "url",
      },
    },
  },
  CoachTick: {
    kind: "object",
    properties: {
      id: {
        wire: "id",
      },
      text: {
        wire: "text",
      },
    },
  },
  CreateFolderDTO: {
    kind: "object",
    properties: {
      activityTypes: {
        wire: "activity_types",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      athleteId: {
        wire: "athlete_id",
      },
      autoRolloutDay: {
        wire: "auto_rollout_day",
      },
      blurb: {
        wire: "blurb",
      },
      canEdit: {
        wire: "canEdit",
      },
      children: {
        wire: "children",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Workout",
          },
        },
      },
      copyFolderId: {
        wire: "copy_folder_id",
      },
      description: {
        wire: "description",
      },
      durationWeeks: {
        wire: "duration_weeks",
      },
      hoursPerWeekMax: {
        wire: "hours_per_week_max",
      },
      hoursPerWeekMin: {
        wire: "hours_per_week_min",
      },
      id: {
        wire: "id",
      },
      name: {
        wire: "name",
      },
      numWorkouts: {
        wire: "num_workouts",
      },
      owner: {
        wire: "owner",
        value: {
          kind: "ref",
          name: "AthleteSearchResult",
        },
      },
      readOnlyWorkouts: {
        wire: "read_only_workouts",
      },
      rolloutWeeks: {
        wire: "rollout_weeks",
      },
      shareToken: {
        wire: "shareToken",
      },
      sharedWithCount: {
        wire: "sharedWithCount",
      },
      startDateLocal: {
        wire: "start_date_local",
      },
      startingAtl: {
        wire: "starting_atl",
      },
      startingCtl: {
        wire: "starting_ctl",
      },
      type: {
        wire: "type",
      },
      visibility: {
        wire: "visibility",
      },
      workoutTargets: {
        wire: "workout_targets",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
    },
  },
  CustomItem: {
    kind: "object",
    properties: {
      athleteId: {
        wire: "athlete_id",
      },
      content: {
        wire: "content",
        value: {
          kind: "dictionary",
          value: {
            kind: "opaque",
          },
        },
      },
      description: {
        wire: "description",
      },
      fromAthlete: {
        wire: "from_athlete",
        value: {
          kind: "ref",
          name: "AthleteSearchResult",
        },
      },
      fromId: {
        wire: "from_id",
      },
      hiddenById: {
        wire: "hidden_by_id",
      },
      hideScript: {
        wire: "hide_script",
      },
      id: {
        wire: "id",
      },
      image: {
        wire: "image",
      },
      index: {
        wire: "index",
      },
      name: {
        wire: "name",
      },
      type: {
        wire: "type",
      },
      updated: {
        wire: "updated",
      },
      usageCount: {
        wire: "usage_count",
      },
      visibility: {
        wire: "visibility",
      },
    },
  },
  DataCurvePt: {
    kind: "object",
    properties: {
      endIndex: {
        wire: "end_index",
      },
      secs: {
        wire: "secs",
      },
      startIndex: {
        wire: "start_index",
      },
      value: {
        wire: "value",
      },
    },
  },
  Display: {
    kind: "object",
    properties: {
      color: {
        wire: "color",
      },
      color2: {
        wire: "color2",
      },
      colorScheme: {
        wire: "colorScheme",
      },
      highIntensity: {
        wire: "highIntensity",
      },
      highLoad: {
        wire: "highLoad",
      },
      ignoreWorkoutColors: {
        wire: "ignoreWorkoutColors",
      },
      lowIntensity: {
        wire: "lowIntensity",
      },
      lowLoad: {
        wire: "lowLoad",
      },
      preciseDistance: {
        wire: "preciseDistance",
      },
      showAverageHR: {
        wire: "showAverageHR",
      },
      showAveragePower: {
        wire: "showAveragePower",
      },
      showDescription: {
        wire: "showDescription",
      },
      showFeel: {
        wire: "showFeel",
      },
      showGAP: {
        wire: "showGAP",
      },
      showIntensity: {
        wire: "showIntensity",
      },
      showIntervals: {
        wire: "showIntervals",
      },
      showLoad: {
        wire: "showLoad",
      },
      showName: {
        wire: "showName",
      },
      showNormalizedWatts: {
        wire: "showNormalizedWatts",
      },
      showPace: {
        wire: "showPace",
      },
      showPairedWorkoutChart: {
        wire: "showPairedWorkoutChart",
      },
      showRPE: {
        wire: "showRPE",
      },
      showSkylineChart: {
        wire: "showSkylineChart",
      },
      showStartTime: {
        wire: "showStartTime",
      },
      showWeightLifted: {
        wire: "showWeightLifted",
      },
      showWork: {
        wire: "showWork",
      },
      showWorkAboveFTP: {
        wire: "showWorkAboveFTP",
      },
      shrinkCommute: {
        wire: "shrinkCommute",
      },
      shrinkCooldown: {
        wire: "shrinkCooldown",
      },
      shrinkWarmup: {
        wire: "shrinkWarmup",
      },
      usePairedWorkoutColor: {
        wire: "usePairedWorkoutColor",
      },
    },
  },
  DoomedEvent: {
    kind: "object",
    properties: {
      externalId: {
        wire: "external_id",
      },
      id: {
        wire: "id",
      },
    },
  },
  DuplicateEventsDTO: {
    kind: "object",
    properties: {
      eventIds: {
        wire: "eventIds",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      numCopies: {
        wire: "numCopies",
      },
      weeksBetween: {
        wire: "weeksBetween",
      },
    },
  },
  DuplicateWorkoutsDTO: {
    kind: "object",
    properties: {
      numCopies: {
        wire: "numCopies",
      },
      weeksBetween: {
        wire: "weeksBetween",
      },
      workoutIds: {
        wire: "workoutIds",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
    },
  },
  Event: {
    kind: "object",
    properties: {
      athleteCannotEdit: {
        wire: "athlete_cannot_edit",
      },
      athleteId: {
        wire: "athlete_id",
      },
      atlDays: {
        wire: "atl_days",
      },
      attachments: {
        wire: "attachments",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Attachment",
          },
        },
      },
      calendarId: {
        wire: "calendar_id",
      },
      canTrainSports: {
        wire: "can_train_sports",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      carbsPerHour: {
        wire: "carbs_per_hour",
      },
      carbsUsed: {
        wire: "carbs_used",
      },
      category: {
        wire: "category",
      },
      color: {
        wire: "color",
      },
      createdById: {
        wire: "created_by_id",
      },
      ctlDays: {
        wire: "ctl_days",
      },
      description: {
        wire: "description",
      },
      distance: {
        wire: "distance",
      },
      distanceTarget: {
        wire: "distance_target",
      },
      endDateLocal: {
        wire: "end_date_local",
      },
      entered: {
        wire: "entered",
      },
      externalId: {
        wire: "external_id",
      },
      forWeek: {
        wire: "for_week",
      },
      hideFromAthlete: {
        wire: "hide_from_athlete",
      },
      icuAtl: {
        wire: "icu_atl",
      },
      icuCtl: {
        wire: "icu_ctl",
      },
      icuFtp: {
        wire: "icu_ftp",
      },
      icuIntensity: {
        wire: "icu_intensity",
      },
      icuTrainingLoad: {
        wire: "icu_training_load",
      },
      id: {
        wire: "id",
      },
      indoor: {
        wire: "indoor",
      },
      joules: {
        wire: "joules",
      },
      joulesAboveFtp: {
        wire: "joules_above_ftp",
      },
      loadTarget: {
        wire: "load_target",
      },
      maxTrainingTime: {
        wire: "max_training_time",
      },
      movingTime: {
        wire: "moving_time",
      },
      name: {
        wire: "name",
      },
      notOnFitnessChart: {
        wire: "not_on_fitness_chart",
      },
      oauthClientId: {
        wire: "oauth_client_id",
      },
      pMax: {
        wire: "p_max",
      },
      planApplied: {
        wire: "plan_applied",
      },
      planAthleteId: {
        wire: "plan_athlete_id",
      },
      planFolderId: {
        wire: "plan_folder_id",
      },
      planWorkoutId: {
        wire: "plan_workout_id",
      },
      pushErrors: {
        wire: "push_errors",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "PushError",
          },
        },
      },
      sharedEventId: {
        wire: "shared_event_id",
      },
      showAsNote: {
        wire: "show_as_note",
      },
      showOnCtlLine: {
        wire: "show_on_ctl_line",
      },
      ssCp: {
        wire: "ss_cp",
      },
      ssPMax: {
        wire: "ss_p_max",
      },
      ssWPrime: {
        wire: "ss_w_prime",
      },
      startDateLocal: {
        wire: "start_date_local",
      },
      strainScore: {
        wire: "strain_score",
      },
      structureReadOnly: {
        wire: "structure_read_only",
      },
      subType: {
        wire: "sub_type",
      },
      tags: {
        wire: "tags",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      target: {
        wire: "target",
      },
      timeTarget: {
        wire: "time_target",
      },
      trainingAvailability: {
        wire: "training_availability",
      },
      type: {
        wire: "type",
      },
      uid: {
        wire: "uid",
      },
      updated: {
        wire: "updated",
      },
      wPrime: {
        wire: "w_prime",
      },
      workoutDoc: {
        wire: "workout_doc",
        value: {
          kind: "dictionary",
          value: {
            kind: "opaque",
          },
        },
      },
    },
  },
  EventEx: {
    kind: "object",
    properties: {
      athleteCannotEdit: {
        wire: "athlete_cannot_edit",
      },
      athleteId: {
        wire: "athlete_id",
      },
      atlDays: {
        wire: "atl_days",
      },
      attachments: {
        wire: "attachments",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Attachment",
          },
        },
      },
      calendarId: {
        wire: "calendar_id",
      },
      canTrainSports: {
        wire: "can_train_sports",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      carbsPerHour: {
        wire: "carbs_per_hour",
      },
      carbsUsed: {
        wire: "carbs_used",
      },
      category: {
        wire: "category",
      },
      color: {
        wire: "color",
      },
      createdById: {
        wire: "created_by_id",
      },
      ctlDays: {
        wire: "ctl_days",
      },
      description: {
        wire: "description",
      },
      distance: {
        wire: "distance",
      },
      distanceTarget: {
        wire: "distance_target",
      },
      endDateLocal: {
        wire: "end_date_local",
      },
      entered: {
        wire: "entered",
      },
      externalId: {
        wire: "external_id",
      },
      fileContents: {
        wire: "file_contents",
      },
      fileContentsBase64: {
        wire: "file_contents_base64",
      },
      filename: {
        wire: "filename",
      },
      forWeek: {
        wire: "for_week",
      },
      hideFromAthlete: {
        wire: "hide_from_athlete",
      },
      icuAtl: {
        wire: "icu_atl",
      },
      icuCtl: {
        wire: "icu_ctl",
      },
      icuFtp: {
        wire: "icu_ftp",
      },
      icuIntensity: {
        wire: "icu_intensity",
      },
      icuTrainingLoad: {
        wire: "icu_training_load",
      },
      id: {
        wire: "id",
      },
      indoor: {
        wire: "indoor",
      },
      joules: {
        wire: "joules",
      },
      joulesAboveFtp: {
        wire: "joules_above_ftp",
      },
      loadTarget: {
        wire: "load_target",
      },
      maxTrainingTime: {
        wire: "max_training_time",
      },
      movingTime: {
        wire: "moving_time",
      },
      name: {
        wire: "name",
      },
      notOnFitnessChart: {
        wire: "not_on_fitness_chart",
      },
      oauthClientId: {
        wire: "oauth_client_id",
      },
      pMax: {
        wire: "p_max",
      },
      planApplied: {
        wire: "plan_applied",
      },
      planAthleteId: {
        wire: "plan_athlete_id",
      },
      planFolderId: {
        wire: "plan_folder_id",
      },
      planWorkoutId: {
        wire: "plan_workout_id",
      },
      pushErrors: {
        wire: "push_errors",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "PushError",
          },
        },
      },
      sharedEventId: {
        wire: "shared_event_id",
      },
      showAsNote: {
        wire: "show_as_note",
      },
      showOnCtlLine: {
        wire: "show_on_ctl_line",
      },
      ssCp: {
        wire: "ss_cp",
      },
      ssPMax: {
        wire: "ss_p_max",
      },
      ssWPrime: {
        wire: "ss_w_prime",
      },
      startDateLocal: {
        wire: "start_date_local",
      },
      strainScore: {
        wire: "strain_score",
      },
      structureReadOnly: {
        wire: "structure_read_only",
      },
      subType: {
        wire: "sub_type",
      },
      tags: {
        wire: "tags",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      target: {
        wire: "target",
      },
      timeTarget: {
        wire: "time_target",
      },
      trainingAvailability: {
        wire: "training_availability",
      },
      type: {
        wire: "type",
      },
      uid: {
        wire: "uid",
      },
      updated: {
        wire: "updated",
      },
      wPrime: {
        wire: "w_prime",
      },
      workout: {
        wire: "workout",
        value: {
          kind: "ref",
          name: "Workout",
        },
      },
      workoutDoc: {
        wire: "workout_doc",
        value: {
          kind: "dictionary",
          value: {
            kind: "opaque",
          },
        },
      },
    },
  },
  Folder: {
    kind: "object",
    properties: {
      activityTypes: {
        wire: "activity_types",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      athleteId: {
        wire: "athlete_id",
      },
      autoRolloutDay: {
        wire: "auto_rollout_day",
      },
      blurb: {
        wire: "blurb",
      },
      canEdit: {
        wire: "canEdit",
      },
      children: {
        wire: "children",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Workout",
          },
        },
      },
      description: {
        wire: "description",
      },
      durationWeeks: {
        wire: "duration_weeks",
      },
      hoursPerWeekMax: {
        wire: "hours_per_week_max",
      },
      hoursPerWeekMin: {
        wire: "hours_per_week_min",
      },
      id: {
        wire: "id",
      },
      name: {
        wire: "name",
      },
      numWorkouts: {
        wire: "num_workouts",
      },
      owner: {
        wire: "owner",
        value: {
          kind: "ref",
          name: "AthleteSearchResult",
        },
      },
      readOnlyWorkouts: {
        wire: "read_only_workouts",
      },
      rolloutWeeks: {
        wire: "rollout_weeks",
      },
      shareToken: {
        wire: "shareToken",
      },
      sharedWithCount: {
        wire: "sharedWithCount",
      },
      startDateLocal: {
        wire: "start_date_local",
      },
      startingAtl: {
        wire: "starting_atl",
      },
      startingCtl: {
        wire: "starting_ctl",
      },
      type: {
        wire: "type",
      },
      visibility: {
        wire: "visibility",
      },
      workoutTargets: {
        wire: "workout_targets",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
    },
  },
  Forecast: {
    kind: "object",
    properties: {
      enabled: {
        wire: "enabled",
      },
      id: {
        wire: "id",
      },
      label: {
        wire: "label",
      },
      lat: {
        wire: "lat",
      },
      location: {
        wire: "location",
      },
      lon: {
        wire: "lon",
      },
      provider: {
        wire: "provider",
      },
    },
  },
  Gear: {
    kind: "object",
    properties: {
      activities: {
        wire: "activities",
      },
      activityFilters: {
        wire: "activity_filters",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "ActivityFilter",
          },
        },
      },
      athleteId: {
        wire: "athlete_id",
      },
      component: {
        wire: "component",
      },
      componentIds: {
        wire: "component_ids",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      distance: {
        wire: "distance",
      },
      id: {
        wire: "id",
      },
      name: {
        wire: "name",
      },
      notes: {
        wire: "notes",
      },
      purchased: {
        wire: "purchased",
      },
      reminders: {
        wire: "reminders",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "GearReminder",
          },
        },
      },
      retired: {
        wire: "retired",
      },
      time: {
        wire: "time",
      },
      type: {
        wire: "type",
      },
      useElapsedTime: {
        wire: "use_elapsed_time",
      },
    },
  },
  GearReminder: {
    kind: "object",
    properties: {
      activities: {
        wire: "activities",
      },
      activitiesUsed: {
        wire: "activities_used",
      },
      days: {
        wire: "days",
      },
      daysUsed: {
        wire: "days_used",
      },
      distance: {
        wire: "distance",
      },
      distanceUsed: {
        wire: "distance_used",
      },
      gearId: {
        wire: "gear_id",
      },
      id: {
        wire: "id",
      },
      lastReset: {
        wire: "last_reset",
      },
      name: {
        wire: "name",
      },
      percentUsed: {
        wire: "percent_used",
      },
      snoozedUntil: {
        wire: "snoozed_until",
      },
      startingActivities: {
        wire: "starting_activities",
      },
      startingDistance: {
        wire: "starting_distance",
      },
      startingTime: {
        wire: "starting_time",
      },
      time: {
        wire: "time",
      },
      timeUsed: {
        wire: "time_used",
      },
    },
  },
  HRRecovery: {
    kind: "object",
    properties: {
      averageWatts: {
        wire: "average_watts",
      },
      endBpm: {
        wire: "end_bpm",
      },
      endIndex: {
        wire: "end_index",
      },
      endTime: {
        wire: "end_time",
      },
      hrr: {
        wire: "hrr",
      },
      startBpm: {
        wire: "start_bpm",
      },
      startIndex: {
        wire: "start_index",
      },
      startTime: {
        wire: "start_time",
      },
    },
  },
  IcuAchievement: {
    kind: "object",
    properties: {
      distance: {
        wire: "distance",
      },
      id: {
        wire: "id",
      },
      message: {
        wire: "message",
      },
      pace: {
        wire: "pace",
      },
      point: {
        wire: "point",
        value: {
          kind: "ref",
          name: "DataCurvePt",
        },
      },
      secs: {
        wire: "secs",
      },
      type: {
        wire: "type",
      },
      value: {
        wire: "value",
      },
      watts: {
        wire: "watts",
      },
    },
  },
  Ignore: {
    kind: "object",
    properties: {
      endIndex: {
        wire: "end_index",
      },
      hr: {
        wire: "hr",
      },
      pace: {
        wire: "pace",
      },
      power: {
        wire: "power",
      },
      startIndex: {
        wire: "start_index",
      },
    },
  },
  Interval: {
    kind: "object",
    properties: {
      averageCadence: {
        wire: "average_cadence",
      },
      averageDfaA1: {
        wire: "average_dfa_a1",
      },
      averageEpoc: {
        wire: "average_epoc",
      },
      averageFeelsLike: {
        wire: "average_feels_like",
      },
      averageGradient: {
        wire: "average_gradient",
      },
      averageHeartrate: {
        wire: "average_heartrate",
      },
      averageImpactLoadingRate: {
        wire: "average_impact_loading_rate",
      },
      averageLactate: {
        wire: "average_lactate",
      },
      averageLegSpringStiffness: {
        wire: "average_leg_spring_stiffness",
      },
      averageRespiration: {
        wire: "average_respiration",
      },
      averageSmo2: {
        wire: "average_smo2",
      },
      averageSmo22: {
        wire: "average_smo2_2",
      },
      averageSpeed: {
        wire: "average_speed",
      },
      averageStanceTime: {
        wire: "average_stance_time",
      },
      averageStanceTimeBalance: {
        wire: "average_stance_time_balance",
      },
      averageStanceTimePercent: {
        wire: "average_stance_time_percent",
      },
      averageStepLength: {
        wire: "average_step_length",
      },
      averageStride: {
        wire: "average_stride",
      },
      averageTemp: {
        wire: "average_temp",
      },
      averageThb: {
        wire: "average_thb",
      },
      averageThb2: {
        wire: "average_thb_2",
      },
      averageTidalVolume: {
        wire: "average_tidal_volume",
      },
      averageTidalVolumeMin: {
        wire: "average_tidal_volume_min",
      },
      averageTorque: {
        wire: "average_torque",
      },
      averageVerticalOscillation: {
        wire: "average_vertical_oscillation",
      },
      averageVerticalRatio: {
        wire: "average_vertical_ratio",
      },
      averageVerticalSpeed: {
        wire: "average_vertical_speed",
      },
      averageWatts: {
        wire: "average_watts",
      },
      averageWattsAlt: {
        wire: "average_watts_alt",
      },
      averageWattsAltAcc: {
        wire: "average_watts_alt_acc",
      },
      averageWattsKg: {
        wire: "average_watts_kg",
      },
      averageWeatherTemp: {
        wire: "average_weather_temp",
      },
      averageWindGust: {
        wire: "average_wind_gust",
      },
      averageWindSpeed: {
        wire: "average_wind_speed",
      },
      averageYaw: {
        wire: "average_yaw",
      },
      avgLrBalance: {
        wire: "avg_lr_balance",
      },
      decoupling: {
        wire: "decoupling",
      },
      distance: {
        wire: "distance",
      },
      elapsedTime: {
        wire: "elapsed_time",
      },
      endIndex: {
        wire: "end_index",
      },
      endTime: {
        wire: "end_time",
      },
      gap: {
        wire: "gap",
      },
      groupId: {
        wire: "group_id",
      },
      headwindPercent: {
        wire: "headwind_percent",
      },
      id: {
        wire: "id",
      },
      intensity: {
        wire: "intensity",
      },
      joules: {
        wire: "joules",
      },
      joulesAboveFtp: {
        wire: "joules_above_ftp",
      },
      label: {
        wire: "label",
      },
      maxAltitude: {
        wire: "max_altitude",
      },
      maxCadence: {
        wire: "max_cadence",
      },
      maxHeartrate: {
        wire: "max_heartrate",
      },
      maxLactate: {
        wire: "max_lactate",
      },
      maxSpeed: {
        wire: "max_speed",
      },
      maxTorque: {
        wire: "max_torque",
      },
      maxWatts: {
        wire: "max_watts",
      },
      maxWattsKg: {
        wire: "max_watts_kg",
      },
      minAltitude: {
        wire: "min_altitude",
      },
      minCadence: {
        wire: "min_cadence",
      },
      minHeartrate: {
        wire: "min_heartrate",
      },
      minLactate: {
        wire: "min_lactate",
      },
      minSpeed: {
        wire: "min_speed",
      },
      minTorque: {
        wire: "min_torque",
      },
      minWatts: {
        wire: "min_watts",
      },
      movingTime: {
        wire: "moving_time",
      },
      prevailingWindDeg: {
        wire: "prevailing_wind_deg",
      },
      segmentEffortIds: {
        wire: "segment_effort_ids",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      ssCp: {
        wire: "ss_cp",
      },
      ssPMax: {
        wire: "ss_p_max",
      },
      ssWPrime: {
        wire: "ss_w_prime",
      },
      startIndex: {
        wire: "start_index",
      },
      startTime: {
        wire: "start_time",
      },
      strainScore: {
        wire: "strain_score",
      },
      tailwindPercent: {
        wire: "tailwind_percent",
      },
      totalElevationGain: {
        wire: "total_elevation_gain",
      },
      trainingLoad: {
        wire: "training_load",
      },
      type: {
        wire: "type",
      },
      w5sVariability: {
        wire: "w5s_variability",
      },
      wbalEnd: {
        wire: "wbal_end",
      },
      wbalStart: {
        wire: "wbal_start",
      },
      weightedAverageWatts: {
        wire: "weighted_average_watts",
      },
      zone: {
        wire: "zone",
      },
      zoneMaxWatts: {
        wire: "zone_max_watts",
      },
      zoneMinWatts: {
        wire: "zone_min_watts",
      },
    },
  },
  Message: {
    kind: "object",
    properties: {
      acceptCoachingGroupId: {
        wire: "accept_coaching_group_id",
      },
      activity: {
        wire: "activity",
        value: {
          kind: "ref",
          name: "Activity",
        },
      },
      activityId: {
        wire: "activity_id",
      },
      answer: {
        wire: "answer",
      },
      athleteId: {
        wire: "athlete_id",
      },
      attachmentMimeType: {
        wire: "attachment_mime_type",
      },
      attachmentUrl: {
        wire: "attachment_url",
      },
      content: {
        wire: "content",
      },
      created: {
        wire: "created",
      },
      deleted: {
        wire: "deleted",
      },
      deletedById: {
        wire: "deleted_by_id",
      },
      endIndex: {
        wire: "end_index",
      },
      id: {
        wire: "id",
      },
      joinGroupId: {
        wire: "join_group_id",
      },
      name: {
        wire: "name",
      },
      seen: {
        wire: "seen",
      },
      startIndex: {
        wire: "start_index",
      },
      type: {
        wire: "type",
      },
    },
  },
  NewActivityMsg: {
    kind: "object",
    properties: {
      content: {
        wire: "content",
      },
    },
  },
  NewMessage: {
    kind: "object",
    properties: {
      acceptCoachingGroupId: {
        wire: "accept_coaching_group_id",
      },
      activity: {
        wire: "activity",
        value: {
          kind: "ref",
          name: "Activity",
        },
      },
      activityId: {
        wire: "activity_id",
      },
      answer: {
        wire: "answer",
      },
      askACoach: {
        wire: "askACoach",
      },
      athleteId: {
        wire: "athlete_id",
      },
      attachmentId: {
        wire: "attachment_id",
      },
      attachmentMimeType: {
        wire: "attachment_mime_type",
      },
      attachmentUrl: {
        wire: "attachment_url",
      },
      chatId: {
        wire: "chat_id",
      },
      content: {
        wire: "content",
      },
      created: {
        wire: "created",
      },
      deleted: {
        wire: "deleted",
      },
      deletedById: {
        wire: "deleted_by_id",
      },
      endIndex: {
        wire: "end_index",
      },
      id: {
        wire: "id",
      },
      joinGroupId: {
        wire: "join_group_id",
      },
      name: {
        wire: "name",
      },
      seen: {
        wire: "seen",
      },
      startIndex: {
        wire: "start_index",
      },
      toActivityId: {
        wire: "to_activity_id",
      },
      toAthleteId: {
        wire: "to_athlete_id",
      },
      type: {
        wire: "type",
      },
    },
  },
  Pos: {
    kind: "object",
    properties: {
      height: {
        wire: "height",
      },
      id: {
        wire: "id",
      },
      width: {
        wire: "width",
      },
    },
  },
  PowerModel: {
    kind: "object",
    properties: {
      criticalPower: {
        wire: "criticalPower",
      },
      ftp: {
        wire: "ftp",
      },
      inputPointIndexes: {
        wire: "inputPointIndexes",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      pMax: {
        wire: "pMax",
      },
      type: {
        wire: "type",
      },
      wPrime: {
        wire: "wPrime",
      },
    },
  },
  PushError: {
    kind: "object",
    properties: {
      date: {
        wire: "date",
      },
      message: {
        wire: "message",
      },
      service: {
        wire: "service",
      },
    },
  },
  Settings: {
    kind: "object",
    properties: {
      atlFactor: {
        wire: "atlFactor",
      },
      ctlFactor: {
        wire: "ctlFactor",
      },
      type: {
        wire: "type",
      },
    },
  },
  SharedWith: {
    kind: "object",
    properties: {
      bio: {
        wire: "bio",
      },
      canEdit: {
        wire: "canEdit",
      },
      city: {
        wire: "city",
      },
      country: {
        wire: "country",
      },
      email: {
        wire: "email",
      },
      id: {
        wire: "id",
      },
      name: {
        wire: "name",
      },
      profileMedium: {
        wire: "profile_medium",
      },
      sex: {
        wire: "sex",
      },
      state: {
        wire: "state",
      },
      timezone: {
        wire: "timezone",
      },
      website: {
        wire: "website",
      },
    },
  },
  SportInfo: {
    kind: "object",
    properties: {
      eftp: {
        wire: "eftp",
      },
      pMax: {
        wire: "pMax",
      },
      type: {
        wire: "type",
      },
      wPrime: {
        wire: "wPrime",
      },
    },
  },
  SportSettings: {
    kind: "object",
    properties: {
      activityCharts: {
        wire: "activity_charts",
        value: {
          kind: "ref",
          name: "ActivityCharts",
        },
      },
      activityFieldIds: {
        wire: "activity_field_ids",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      afterKj0: {
        wire: "after_kj0",
      },
      afterKj1: {
        wire: "after_kj1",
      },
      athleteId: {
        wire: "athlete_id",
      },
      bestEffortDistances: {
        wire: "best_effort_distances",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      calendarTileActivityPanelId: {
        wire: "calendar_tile_activity_panel_id",
      },
      cooldownTime: {
        wire: "cooldown_time",
      },
      created: {
        wire: "created",
      },
      customFieldIds: {
        wire: "custom_field_ids",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      customFieldValues: {
        wire: "custom_field_values",
        value: {
          kind: "dictionary",
          value: {
            kind: "opaque",
          },
        },
      },
      customZonesIds: {
        wire: "custom_zones_ids",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      defaultGearId: {
        wire: "default_gear_id",
      },
      defaultIndoorGearId: {
        wire: "default_indoor_gear_id",
      },
      defaultWorkoutTime: {
        wire: "default_workout_time",
      },
      display: {
        wire: "display",
        value: {
          kind: "ref",
          name: "Display",
        },
      },
      elevationCorrection: {
        wire: "elevation_correction",
      },
      extractWorkouts: {
        wire: "extract_workouts",
      },
      ftp: {
        wire: "ftp",
      },
      ftpEstMinSecs: {
        wire: "ftp_est_min_secs",
      },
      gapModel: {
        wire: "gap_model",
      },
      hrLoadType: {
        wire: "hr_load_type",
      },
      hrZoneNames: {
        wire: "hr_zone_names",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      hrZones: {
        wire: "hr_zones",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      hrrcMinPercent: {
        wire: "hrrc_min_percent",
      },
      id: {
        wire: "id",
      },
      ignoreVelocity: {
        wire: "ignore_velocity",
      },
      indoorFtp: {
        wire: "indoor_ftp",
      },
      intervalDisplay: {
        wire: "interval_display",
      },
      iseFTPSupported: {
        wire: "iseFTPSupported",
      },
      keepAllLapsForPowerIntervals: {
        wire: "keep_all_laps_for_power_intervals",
      },
      loadOrder: {
        wire: "load_order",
      },
      lthr: {
        wire: "lthr",
      },
      maxHr: {
        wire: "max_hr",
      },
      mmpModel: {
        wire: "mmp_model",
        value: {
          kind: "ref",
          name: "PowerModel",
        },
      },
      other: {
        wire: "other",
      },
      pMax: {
        wire: "p_max",
      },
      paceCurveStart: {
        wire: "pace_curve_start",
      },
      paceLoadType: {
        wire: "pace_load_type",
      },
      paceUnits: {
        wire: "pace_units",
      },
      paceZoneNames: {
        wire: "pace_zone_names",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      paceZones: {
        wire: "pace_zones",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      powerField: {
        wire: "power_field",
      },
      powerIntervalsStartLocked: {
        wire: "power_intervals_start_locked",
      },
      powerSpikeThreshold: {
        wire: "power_spike_threshold",
      },
      powerZoneNames: {
        wire: "power_zone_names",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      powerZones: {
        wire: "power_zones",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      showPauses: {
        wire: "show_pauses",
      },
      sweetSpotMax: {
        wire: "sweet_spot_max",
      },
      sweetSpotMin: {
        wire: "sweet_spot_min",
      },
      thresholdPace: {
        wire: "threshold_pace",
      },
      tizOrder: {
        wire: "tiz_order",
      },
      types: {
        wire: "types",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      updateActivityNameFromWorkout: {
        wire: "update_activity_name_from_workout",
      },
      updated: {
        wire: "updated",
      },
      useDistanceForIntervals: {
        wire: "use_distance_for_intervals",
      },
      useGapZoneTimes: {
        wire: "use_gap_zone_times",
      },
      useLapsForPowerIntervals: {
        wire: "use_laps_for_power_intervals",
      },
      wPrime: {
        wire: "w_prime",
      },
      warmupTime: {
        wire: "warmup_time",
      },
      workoutOrder: {
        wire: "workout_order",
      },
    },
  },
  StravaGear: {
    kind: "object",
    properties: {
      distance: {
        wire: "distance",
      },
      id: {
        wire: "id",
      },
      name: {
        wire: "name",
      },
      primary: {
        wire: "primary",
      },
    },
  },
  WeatherConfig: {
    kind: "object",
    properties: {
      forecasts: {
        wire: "forecasts",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Forecast",
          },
        },
      },
    },
  },
  Wellness: {
    kind: "object",
    properties: {
      abdomen: {
        wire: "abdomen",
      },
      atl: {
        wire: "atl",
      },
      atlLoad: {
        wire: "atlLoad",
      },
      avgSleepingHR: {
        wire: "avgSleepingHR",
      },
      baevskySI: {
        wire: "baevskySI",
      },
      bloodGlucose: {
        wire: "bloodGlucose",
      },
      bodyFat: {
        wire: "bodyFat",
      },
      carbohydrates: {
        wire: "carbohydrates",
      },
      comments: {
        wire: "comments",
      },
      ctl: {
        wire: "ctl",
      },
      ctlLoad: {
        wire: "ctlLoad",
      },
      diastolic: {
        wire: "diastolic",
      },
      fatTotal: {
        wire: "fatTotal",
      },
      fatigue: {
        wire: "fatigue",
      },
      hrv: {
        wire: "hrv",
      },
      hrvSDNN: {
        wire: "hrvSDNN",
      },
      hydration: {
        wire: "hydration",
      },
      hydrationVolume: {
        wire: "hydrationVolume",
      },
      id: {
        wire: "id",
      },
      injury: {
        wire: "injury",
      },
      kcalConsumed: {
        wire: "kcalConsumed",
      },
      lactate: {
        wire: "lactate",
      },
      locked: {
        wire: "locked",
      },
      menstrualPhase: {
        wire: "menstrualPhase",
      },
      menstrualPhasePredicted: {
        wire: "menstrualPhasePredicted",
      },
      mood: {
        wire: "mood",
      },
      motivation: {
        wire: "motivation",
      },
      protein: {
        wire: "protein",
      },
      rampRate: {
        wire: "rampRate",
      },
      readiness: {
        wire: "readiness",
      },
      respiration: {
        wire: "respiration",
      },
      restingHR: {
        wire: "restingHR",
      },
      sleepQuality: {
        wire: "sleepQuality",
      },
      sleepScore: {
        wire: "sleepScore",
      },
      sleepSecs: {
        wire: "sleepSecs",
      },
      soreness: {
        wire: "soreness",
      },
      spO2: {
        wire: "spO2",
      },
      sportInfo: {
        wire: "sportInfo",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "SportInfo",
          },
        },
      },
      steps: {
        wire: "steps",
      },
      stress: {
        wire: "stress",
      },
      systolic: {
        wire: "systolic",
      },
      tempRestingHR: {
        wire: "tempRestingHR",
      },
      tempWeight: {
        wire: "tempWeight",
      },
      updated: {
        wire: "updated",
      },
      vo2max: {
        wire: "vo2max",
      },
      weight: {
        wire: "weight",
      },
    },
  },
  Workout: {
    kind: "object",
    properties: {
      athleteId: {
        wire: "athlete_id",
      },
      attachments: {
        wire: "attachments",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Attachment",
          },
        },
      },
      carbsPerHour: {
        wire: "carbs_per_hour",
      },
      color: {
        wire: "color",
      },
      day: {
        wire: "day",
      },
      days: {
        wire: "days",
      },
      description: {
        wire: "description",
      },
      distance: {
        wire: "distance",
      },
      folderId: {
        wire: "folder_id",
      },
      forWeek: {
        wire: "for_week",
      },
      hideFromAthlete: {
        wire: "hide_from_athlete",
      },
      icuIntensity: {
        wire: "icu_intensity",
      },
      icuTrainingLoad: {
        wire: "icu_training_load",
      },
      id: {
        wire: "id",
      },
      indoor: {
        wire: "indoor",
      },
      joules: {
        wire: "joules",
      },
      joulesAboveFtp: {
        wire: "joules_above_ftp",
      },
      movingTime: {
        wire: "moving_time",
      },
      name: {
        wire: "name",
      },
      planApplied: {
        wire: "plan_applied",
      },
      subType: {
        wire: "sub_type",
      },
      tags: {
        wire: "tags",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      target: {
        wire: "target",
      },
      targets: {
        wire: "targets",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      time: {
        wire: "time",
      },
      type: {
        wire: "type",
      },
      updated: {
        wire: "updated",
      },
      workoutDoc: {
        wire: "workout_doc",
        value: {
          kind: "dictionary",
          value: {
            kind: "opaque",
          },
        },
      },
    },
  },
  WorkoutEx: {
    kind: "object",
    properties: {
      athleteId: {
        wire: "athlete_id",
      },
      attachments: {
        wire: "attachments",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "Attachment",
          },
        },
      },
      carbsPerHour: {
        wire: "carbs_per_hour",
      },
      color: {
        wire: "color",
      },
      day: {
        wire: "day",
      },
      days: {
        wire: "days",
      },
      description: {
        wire: "description",
      },
      distance: {
        wire: "distance",
      },
      fileContents: {
        wire: "file_contents",
      },
      fileContentsBase64: {
        wire: "file_contents_base64",
      },
      filename: {
        wire: "filename",
      },
      folderId: {
        wire: "folder_id",
      },
      forWeek: {
        wire: "for_week",
      },
      hideFromAthlete: {
        wire: "hide_from_athlete",
      },
      icuIntensity: {
        wire: "icu_intensity",
      },
      icuTrainingLoad: {
        wire: "icu_training_load",
      },
      id: {
        wire: "id",
      },
      indoor: {
        wire: "indoor",
      },
      joules: {
        wire: "joules",
      },
      joulesAboveFtp: {
        wire: "joules_above_ftp",
      },
      movingTime: {
        wire: "moving_time",
      },
      name: {
        wire: "name",
      },
      planApplied: {
        wire: "plan_applied",
      },
      subType: {
        wire: "sub_type",
      },
      tags: {
        wire: "tags",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      target: {
        wire: "target",
      },
      targets: {
        wire: "targets",
        value: {
          kind: "array",
          item: {
            kind: "opaque",
          },
        },
      },
      time: {
        wire: "time",
      },
      type: {
        wire: "type",
      },
      updated: {
        wire: "updated",
      },
      workoutDoc: {
        wire: "workout_doc",
        value: {
          kind: "dictionary",
          value: {
            kind: "opaque",
          },
        },
      },
    },
  },
  ZoneInfo: {
    kind: "object",
    properties: {
      end: {
        wire: "end",
      },
      endValue: {
        wire: "end_value",
      },
      id: {
        wire: "id",
      },
      secs: {
        wire: "secs",
      },
      start: {
        wire: "start",
      },
      startValue: {
        wire: "start_value",
      },
    },
  },
  ZoneSet: {
    kind: "object",
    properties: {
      code: {
        wire: "code",
      },
      zones: {
        wire: "zones",
        value: {
          kind: "array",
          item: {
            kind: "ref",
            name: "ZoneInfo",
          },
        },
      },
    },
  },
  ZoneTime: {
    kind: "object",
    properties: {
      id: {
        wire: "id",
      },
      secs: {
        wire: "secs",
      },
    },
  },
} as const;

export type RequestCasingSchemaName = keyof typeof REQUEST_CASING_SCHEMAS;

# Tietomalli

## Project

- id
- name
- code
- author
- updatedAt
- startDate
- endDate
- trackingDate
- calendarId

## Task

- id
- projectId
- parentId
- sortOrder
- wbs
- name
- durationWorkdays
- plannedStart
- plannedEnd
- color
- taskType: task | summary | milestone
- notes

## Baseline

- id
- projectId
- name
- createdAt
- createdBy

## BaselineTask

- baselineId
- taskId
- start
- end
- duration
- nameSnapshot

## Progress

- taskId
- trackingDate
- actualStart
- actualEnd
- percentComplete
- forecastEnd
- comment

## Calendar

- id
- projectId
- name
- workWeek
- holidays

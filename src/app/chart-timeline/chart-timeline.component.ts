import { Component, OnInit } from '@angular/core';
import { format, addMonths, subMonths } from 'date-fns';
import { faker } from '@faker-js/faker';
import { ChartOptions } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';
import { MessageService } from 'primeng/api';

import 'chartjs-adapter-date-fns';

import { Chart } from 'chart.js';

Chart.register(zoomPlugin);

interface StackData {
  Stack: string;
  LastDate: Date;
}

interface Event {
  EventName: string;
  EventSource: string;
  Start: Date;
  End: Date;
}

@Component({
  selector: 'app-chart-timeline',
  templateUrl: './chart-timeline.component.html',
})
export class ChartTimelineComponent implements OnInit {
  public chartData: any;
  public chartOptions: ChartOptions<'bar'> = {};

  newGroupName: string = '';
  newEventName: string = '';
  selectedGroup: string = '';
  newEventStart: Date | null = null;
  newEventEnd: Date | null = null;
  
  groups: string[] = [];
  events: Event[] = [];

  currentDate: Date = new Date();
  minDate: Date = subMonths(this.currentDate, 1);  // One month before current date
  maxDate: Date = addMonths(this.currentDate, 1);  // One month after current date

  constructor(private messageService: MessageService) {}

  ngOnInit(): void {
    this.generateTestData();
    this.initializeChart();
  }

  // Generate random test data using faker
  generateTestData(): void {
    const numberOfEvents = 20;
    const numberOfGroups = 5;

    // Generate random groups
    this.groups = Array.from({ length: numberOfGroups }, () => faker.company.name());

    // Generate random events
    this.events = Array.from({ length: numberOfEvents }, () => {
      const randomGroup = faker.helpers.arrayElement(this.groups);

      // Use faker.date.between with from and to arguments
      const startDate = faker.date.between({ from: this.minDate, to: this.maxDate });

      // Generate an end date that's at least 1 to 7 days after the start date
      const endDate = faker.date.between({ from: startDate, to: addMonths(startDate, 1) });

      return {
        EventName: faker.commerce.productName(),
        EventSource: randomGroup,
        Start: startDate,
        End: endDate
      };
    });
  }

  initializeChart(): void {
    this.updateChartData();
  }

  updateChartData(): void {
    const labels = this.groups;
    const eventNames = [...new Set(this.events.map(event => event.EventName))];
    const eventColors = eventNames
      .map((val, i) => {
        const color = `hsl(${(i * (360 / (eventNames.length || 1))) % 360}, 100%, 50%, 1)`;
        return color;
      });

    const labelGrouping: Record<string, StackData[]> = {};  // Fixed type here
    const sortedData = this.events.sort((a, b) => a.Start.getTime() - b.Start.getTime());

    const datasets = sortedData.map(event => {
      const start = event.Start.getTime(); // Convert to milliseconds
      const end = event.End.getTime();     // Convert to milliseconds

      let stack: StackData | undefined = undefined;
      let firstStackEntry = false;

      if (labelGrouping[event.EventSource] === undefined) {
        stack = { Stack: 'Stack0', LastDate: event.End };
        labelGrouping[event.EventSource] = [stack];
        firstStackEntry = true;
      } else {
        labelGrouping[event.EventSource].forEach((item: StackData) => {
          if (stack === undefined && item.LastDate.getTime() <= event.Start.getTime()) {
            stack = { ...item };
            item.LastDate = event.End;
          }
        });
        if (stack === undefined) {
          const stackIndex = labelGrouping[event.EventSource].length;
          stack = { Stack: 'Stack' + stackIndex, LastDate: event.End };
          labelGrouping[event.EventSource].push(stack);
          firstStackEntry = true;
        }
      }

      const data: (null | any[])[] = labels.map(() => null);

      const formattedStartDate = format(event.Start, 'yyyy-MM-dd HH:mm');
      const formattedEndDate = format(event.End, 'yyyy-MM-dd HH:mm');

      data[labels.indexOf(event.EventSource)] = [
        start,
        end,
        `${formattedStartDate} - ${formattedEndDate}`
      ];

      return {
        label: `${event.EventName} (${formattedStartDate} - ${formattedEndDate})`, // Custom label format
        data: data,
        backgroundColor: eventColors[eventNames.indexOf(event.EventName)],
        stack: event.EventSource + '_' + stack.Stack
      };
    });

    this.chartData = {
      labels: labels,
      datasets: datasets
    };

    // Set the min and max to the calculated range (1 month before and after current date)
    this.chartOptions = {
      indexAxis: 'y' as const,
      plugins: {
        zoom: {
          zoom: {
            wheel: {
              enabled: true,
            },
            mode: 'x', // Enable zooming on the x-axis (time axis)

            // Smooth zooming
          },
          limits: {
            // axis limits
            y: {min: 0, max: 100},
          },
          pan: {
            enabled: true,
            mode: 'x', // Allow panning on the x-axis only
            // Removed invalid properties rangeMin and rangeMax
          },
        },
        tooltip: {
          callbacks: {
            title: (tooltipItems) => {
              // Show the custom label in the tooltip title
              const datasetIndex = tooltipItems[0].datasetIndex;
              const label = datasets[datasetIndex].label;
              return label || '';
            },
            label: () => {
              // Return empty string or undefined to suppress the data being shown in the tooltip body
              return '';
            }
          },
          position: 'average' as const
        },
        legend: {
          display: false
        },
        title: {
          display: true,
          text: 'Timeline'
        }
      },
      responsive: true,
      scales: {
        x: {
          position: 'top',
          type: 'time',  // Ensure the x-axis is of type 'time'
          min: this.minDate.getTime(), // Set the min date to 1 month before
          max: this.maxDate.getTime(), // Set the max date to 1 month ahead
          time: {// You can zoom into hours and zoom out to days or weeks
            displayFormats: {
              minute: 'dd HH:mm',
              hour: 'MM-dd HH:mm',
              day: 'yyyy-MM-dd',
              week: 'yyyy-MM-dd',
              month: 'yyyy-MMM',
              year: 'yyyy'
            }
          },
          stacked: true
        },
        y: {
          stacked: true,
        },
      }
    };
  }

  addGroup(): void {
    if (this.newGroupName && !this.groups.includes(this.newGroupName)) {
      this.groups.push(this.newGroupName);
      this.updateChartData();
      this.newGroupName = '';
      this.messageService.add({ severity: 'success', summary: 'Group Added', detail: 'New group added successfully!' });
    } else {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Group already exists or name is invalid!' });
    }
  }

  addEvent(): void {
    if (this.newEventName && this.selectedGroup && this.newEventStart && this.newEventEnd) {
      const newEvent = {
        EventName: this.newEventName,
        EventSource: this.selectedGroup,
        Start: this.newEventStart,
        End: this.newEventEnd
      };

      // Ensure the new event is within the date range before adding
      if (newEvent.Start >= this.minDate && newEvent.End <= this.maxDate) {
        this.events.push(newEvent);
        this.updateChartData();
        this.newEventName = '';
        this.selectedGroup = '';
        this.newEventStart = null;
        this.newEventEnd = null;
        this.messageService.add({ severity: 'success', summary: 'Event Added', detail: 'New event added successfully!' });
      } else {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Event must be within the date range!' });
      }
    } else {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Please fill in all event details!' });
    }
  }
}
